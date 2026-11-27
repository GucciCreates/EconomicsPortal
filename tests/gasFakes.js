/**
 * Minimal in-memory fakes of the Google Apps Script services used by
 * backend/Code.gs, so the backend can be tested under Node's `vm`.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function toSignedBytes(buf) {
  return Array.from(buf, (b) => (b > 127 ? b - 256 : b));
}
function fromBytes(bytes) {
  return Buffer.from(bytes.map((b) => b & 0xff));
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) {
        const v = (this.sheet.data[this.row - 1 + r] || [])[this.col - 1 + c];
        line.push(v === undefined ? '' : v);
      }
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    values.forEach((line, r) =>
      line.forEach((v, c) => this.sheet.write(this.row + r, this.col + c, v)),
    );
    return this;
  }
  setValue(v) {
    this.sheet.write(this.row, this.col, v);
    return this;
  }
  setNumberFormat() {
    return this;
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }
  /** Mimics Sheets: a leading apostrophe marks text and is not stored. */
  static store(v) {
    if (typeof v === 'string' && v.startsWith("'")) return v.slice(1);
    if (typeof v === 'string' && v.startsWith('=')) {
      throw new Error('Formula written to sheet: ' + v);
    }
    return v;
  }
  write(row, col, v) {
    while (this.data.length < row) this.data.push([]);
    const line = this.data[row - 1];
    while (line.length < col) line.push('');
    line[col - 1] = FakeSheet.store(v);
  }
  getName() {
    return this.name;
  }
  getLastRow() {
    let last = 0;
    this.data.forEach((line, i) => {
      if (line.some((c) => c !== '' && c !== undefined)) last = i + 1;
    });
    return last;
  }
  getLastColumn() {
    return this.data.reduce((m, line) => {
      let last = 0;
      line.forEach((c, i) => {
        if (c !== '' && c !== undefined) last = i + 1;
      });
      return Math.max(m, last);
    }, 0);
  }
  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getDataRange() {
    return new FakeRange(this, 1, 1, this.getLastRow(), this.getLastColumn());
  }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    values.forEach((v, i) => this.write(row, i + 1, v));
  }
  deleteRow(row) {
    this.data.splice(row - 1, 1);
  }
  setFrozenRows() {}
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    this.sheets[name] = new FakeSheet(name);
    return this.sheets[name];
  }
  getId() {
    return 'fake-spreadsheet';
  }
  getName() {
    return 'EconomicsPortalDB';
  }
}

function iterator(list) {
  let i = 0;
  return { hasNext: () => i < list.length, next: () => list[i++] };
}

function createFakeDrive(clock) {
  const folders = [];
  let seq = 0;
  const makeFolder = (name) => {
    const files = [];
    const folder = {
      name,
      files,
      getFiles: () => iterator(files.filter((f) => !f.trashed)),
    };
    folders.push(folder);
    return folder;
  };
  return {
    folders,
    api: {
      getFoldersByName: (name) => iterator(folders.filter((f) => f.name === name)),
      createFolder: (name) => makeFolder(name),
      getFileById: () => ({
        makeCopy: (name, folder) => {
          const created = new Date(clock() + seq++);
          const file = { name, trashed: false, getDateCreated: () => created, setTrashed: (v) => (file.trashed = v) };
          folder.files.push(file);
          return file;
        },
      }),
    },
  };
}

function createFakeTriggers() {
  const list = [];
  const builder = (handler) => {
    const b = { timeBased: () => b, everyWeeks: () => b, everyDays: () => b, onWeekDay: () => b, atHour: () => b, create: () => list.push({ getHandlerFunction: () => handler }) };
    return b;
  };
  return {
    list,
    api: {
      WeekDay: { SUNDAY: 'SUNDAY', MONDAY: 'MONDAY' },
      getProjectTriggers: () => list.slice(),
      deleteTrigger: (t) => list.splice(list.indexOf(t), 1),
      newTrigger: (handler) => builder(handler),
    },
  };
}

function createBackend() {
  const ss = new FakeSpreadsheet();
  const props = {};
  const cache = {};
  const logs = [];
  const mail = { sent: [], quota: 100 };
  // Google ID tokens the fake tokeninfo endpoint accepts: { credential: claims }.
  const google = { tokens: {}, calls: 0 };
  let now = Date.now();

  const RealDate = Date;
  class ClockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(now);
      else super(...args);
    }
    static now() {
      return now;
    }
  }

  const drive = createFakeDrive(() => now);
  const triggers = createFakeTriggers();

  const context = {
    console,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    Error,
    isNaN,
    isFinite,
    parseInt,
    Date: ClockDate,
    Logger: { log: (m) => logs.push(String(m)) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => {
          props[k] = String(v);
        },
        deleteProperty: (k) => {
          delete props[k];
        },
        getProperties: () => ({ ...props }),
        setProperties: (obj) => {
          Object.entries(obj).forEach(([k, v]) => (props[k] = String(v)));
        },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => {
          const e = cache[k];
          if (!e || e.expires < now) return null;
          return e.value;
        },
        put: (k, v, ttl) => {
          cache[k] = { value: String(v), expires: now + (ttl || 600) * 1000 };
        },
        remove: (k) => {
          delete cache[k];
        },
        getAll: (keys) => {
          const out = {};
          keys.forEach((k) => {
            const e = cache[k];
            if (e && e.expires >= now) out[k] = e.value;
          });
          return out;
        },
        putAll: (obj, ttl) => {
          Object.entries(obj).forEach(([k, v]) => {
            if (String(v).length > 100 * 1024) throw new Error('Cache value too large: ' + k);
            cache[k] = { value: String(v), expires: now + (ttl || 600) * 1000 };
          });
        },
      }),
    },
    LockService: {
      getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, value) =>
        toSignedBytes(crypto.createHash(alg).update(String(value), 'utf8').digest()),
      computeHmacSha256Signature: (value, key) =>
        toSignedBytes(crypto.createHmac('sha256', key).update(String(value), 'utf8').digest()),
      base64EncodeWebSafe: (data) => {
        const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : fromBytes(data);
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      base64DecodeWebSafe: (str) => {
        const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
        return toSignedBytes(Buffer.from(b64, 'base64'));
      },
      newBlob: (bytes) => ({ getDataAsString: () => fromBytes(bytes).toString('utf8') }),
      formatDate: (d) => new RealDate(d).toISOString().slice(0, 10),
    },
    Session: { getScriptTimeZone: () => 'UTC', getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    MailApp: {
      getRemainingDailyQuota: () => mail.quota - mail.sent.length,
      sendEmail: (to, subject, body) => mail.sent.push({ to, subject, body }),
    },
    UrlFetchApp: {
      fetch: (url) => {
        google.calls++;
        const m = /^https:\/\/oauth2\.googleapis\.com\/tokeninfo\?id_token=(.*)$/.exec(String(url));
        const claims = m && google.tokens[decodeURIComponent(m[1])];
        return {
          getResponseCode: () => (claims ? 200 : 400),
          getContentText: () => JSON.stringify(claims || { error: 'invalid_token' }),
        };
      },
    },
    DriveApp: drive.api,
    ScriptApp: triggers.api,
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({
        content,
        setMimeType() {
          return this;
        },
      }),
    },
  };
  vm.createContext(context);

  const code = fs.readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');
  const exportsList =
    'doGet, doPost, setup, migratePins, migrateSubmissions, setPinForUser, hashPin, normalizeName, installBackupTrigger, runBackup, resetAllPins, installEmailTriggers, sendDeadlineReminders, sendWeeklySummary, clearCache';
  const api = vm.runInContext(`${code}\n;({ ${exportsList} })`, context, {
    filename: 'Code.gs',
  });

  function post(body) {
    const out = api.doPost({ postData: { contents: JSON.stringify(body) } });
    return JSON.parse(out.content);
  }
  function get(params) {
    return JSON.parse(api.doGet({ parameter: params }).content);
  }

  return {
    api,
    ss,
    drive,
    triggers,
    props,
    cache,
    mail,
    google,
    logs,
    post,
    get,
    advance(ms) {
      now += ms;
    },
  };
}

module.exports = { createBackend };
