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

function createBackend() {
  const ss = new FakeSpreadsheet();
  const props = {};
  const cache = {};
  const logs = [];
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
    Session: { getScriptTimeZone: () => 'UTC' },
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
    'doGet, doPost, setup, migratePins, migrateSubmissions, setPinForUser, hashPin, normalizeName';
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
    props,
    logs,
    post,
    get,
    advance(ms) {
      now += ms;
    },
  };
}

module.exports = { createBackend };
