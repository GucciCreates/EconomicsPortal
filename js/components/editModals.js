/**
 * EconomicsPortal — "Edit mark" and "Edit task" dialogs.
 * Each calls onSave(fields) with only the fields that changed.
 */

import { esc } from "../utils.js";
import { openModal } from "./modal.js";
import { teamOptions } from "./ui.js";

const yesNo = (id, label, value, allowBlank) => `
  <div class="form-group">
    <label class="form-label" for="${id}">${label}</label>
    <select id="${id}" class="form-control">
      ${allowBlank ? `<option value="">Not recorded</option>` : ""}
      <option value="Yes" ${value === "Yes" ? "selected" : ""}>Yes</option>
      <option value="No" ${value === "No" ? "selected" : ""}>No</option>
    </select>
  </div>`;

export function openEditMarkModal(mark, onSave) {
  const { dialog, close } = openModal({
    title: `Edit mark: ${mark.member}`,
    maxWidth: "540px",
    bodyHtml: `
      <form id="form-edit-mark">
        <div class="form-group">
          <label class="form-label" for="edit-mark-cycle">Topic or unit</label>
          <input type="text" id="edit-mark-cycle" class="form-control" maxlength="100" value="${esc(mark.cycle || "")}" required />
        </div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit-mark-quiz">Score (0–100)</label>
            <input type="number" id="edit-mark-quiz" class="form-control" min="0" max="100" value="${esc(mark.quizScore)}" required />
          </div>
          ${yesNo("edit-mark-sub", "Work submitted", mark.submission, false)}
          <div class="form-group">
            <label class="form-label" for="edit-mark-att">Attendance</label>
            <input type="text" id="edit-mark-att" class="form-control" maxlength="20" value="${esc(mark.attendance || "")}" placeholder="e.g. 95%" />
          </div>
          ${yesNo("edit-mark-prev", "Preview done", mark.previewDone, true)}
          <div class="form-group">
            <label class="form-label" for="edit-mark-peer">Peer rating (1–5)</label>
            <input type="number" step="0.1" min="1" max="5" id="edit-mark-peer" class="form-control" value="${esc(mark.peerRating || "")}" />
          </div>
          ${yesNo("edit-mark-punctual", "On time", mark.punctual, true)}
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-mark-notes">Notes, or why it changed</label>
          <input type="text" id="edit-mark-notes" class="form-control" maxlength="1000" value="${esc(mark.notes || "")}" />
        </div>
        <div class="modal-btn-row">
          <button type="button" class="btn btn-secondary" data-modal-close id="btn-cancel-edit-mark">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-mark">Save changes</button>
        </div>
      </form>`,
  });

  dialog.querySelector("#form-edit-mark").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (id) => dialog.querySelector(id).value;
    const next = {
      cycle: val("#edit-mark-cycle").trim(),
      quizScore: Number(val("#edit-mark-quiz")),
      submission: val("#edit-mark-sub"),
      attendance: val("#edit-mark-att"),
      previewDone: val("#edit-mark-prev"),
      peerRating: val("#edit-mark-peer"),
      punctual: val("#edit-mark-punctual"),
      notes: val("#edit-mark-notes"),
    };
    const fields = {};
    Object.entries(next).forEach(([k, v]) => {
      const before = mark[k] === undefined || mark[k] === null ? "" : mark[k];
      if (k === "quizScore" ? v !== Number(before) : String(v) !== String(before)) fields[k] = v;
    });
    close();
    if (Object.keys(fields).length) onSave(fields);
  });
}

export function openEditTaskModal(task, onSave) {
  const { dialog, close } = openModal({
    title: "Edit task",
    maxWidth: "540px",
    bodyHtml: `
      <form id="form-edit-task">
        <div class="form-group">
          <label class="form-label" for="edit-task-title">Title</label>
          <input type="text" id="edit-task-title" class="form-control" maxlength="200" value="${esc(task.title)}" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-task-desc">Instructions</label>
          <textarea id="edit-task-desc" class="form-control" rows="3" maxlength="5000">${esc(task.description || "")}</textarea>
        </div>
        <div class="form-grid form-grid-2">
          <div class="form-group">
            <label class="form-label" for="edit-task-team">For</label>
            <select id="edit-task-team" class="form-control">${teamOptions(task.team)}</select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-task-due">Due date</label>
            <input type="date" id="edit-task-due" class="form-control" value="${esc(task.dueDate || "")}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-task-file">Link to the file <span class="optional">optional</span></label>
          <input type="url" id="edit-task-file" class="form-control" value="${esc(task.fileUrl || "")}" placeholder="https://drive.google.com/…" />
        </div>
        <div class="modal-btn-row">
          <button type="button" class="btn btn-secondary" data-modal-close id="btn-cancel-edit-task">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-task">Save changes</button>
        </div>
      </form>`,
  });

  dialog.querySelector("#form-edit-task").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (id) => dialog.querySelector(id).value;
    const next = {
      title: val("#edit-task-title"),
      description: val("#edit-task-desc"),
      team: val("#edit-task-team"),
      dueDate: val("#edit-task-due"),
      fileUrl: val("#edit-task-file"),
    };
    const fields = {};
    Object.entries(next).forEach(([k, v]) => {
      if (String(v) !== String(task[k] || "")) fields[k] = v;
    });
    close();
    if (Object.keys(fields).length) onSave(fields);
  });
}
