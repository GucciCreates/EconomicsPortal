/**
 * EconomicsPortal — Modal Form Handlers for Edit Mark & Edit Task (v2)
 */

import { esc } from "../utils.js";

export function openEditMarkModal(mark, onSave) {
  const existing = document.getElementById("edit-mark-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "edit-mark-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700;">Edit Mark — ${esc(mark.member)} (${esc(mark.cycle)})</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-edit-mark">✕</button>
      </div>

      <form id="form-edit-mark">
        <div class="form-group">
          <label class="form-label" for="edit-mark-cycle">Tested Topic / Unit</label>
          <input type="text" id="edit-mark-cycle" class="form-control" value="${esc(mark.cycle || "")}" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group">
            <label class="form-label" for="edit-mark-quiz">Quiz Score (0-100)</label>
            <input type="number" id="edit-mark-quiz" class="form-control" min="0" max="100" value="${esc(mark.quizScore)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-mark-sub">Submission</label>
            <select id="edit-mark-sub" class="form-control">
              <option value="Yes" ${mark.submission === "Yes" ? "selected" : ""}>Yes</option>
              <option value="No" ${mark.submission === "No" ? "selected" : ""}>No</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group">
            <label class="form-label" for="edit-mark-att">Attendance Rate</label>
            <input type="text" id="edit-mark-att" class="form-control" value="${esc(mark.attendance || "100%")}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-mark-prev">Preview Completed</label>
            <select id="edit-mark-prev" class="form-control">
              <option value="">Not tracked</option>
              <option value="Yes" ${mark.previewDone === "Yes" ? "selected" : ""}>Yes</option>
              <option value="No" ${mark.previewDone === "No" ? "selected" : ""}>No</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group">
            <label class="form-label" for="edit-mark-peer">Peer Rating (1-5)</label>
            <input type="number" step="0.1" min="1" max="5" id="edit-mark-peer" class="form-control" value="${esc(mark.peerRating || "")}" placeholder="e.g. 4.5" />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-mark-punctual">Punctual</label>
            <select id="edit-mark-punctual" class="form-control">
              <option value="">Not tracked</option>
              <option value="Yes" ${mark.punctual === "Yes" ? "selected" : ""}>Yes</option>
              <option value="No" ${mark.punctual === "No" ? "selected" : ""}>No</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-mark-notes">Performance Notes / Re-mark reason</label>
          <input type="text" id="edit-mark-notes" class="form-control" value="${esc(mark.notes || "")}" placeholder="Notes..." />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-edit-mark">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-mark">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#btn-close-edit-mark").addEventListener("click", close);
  modal.querySelector("#btn-cancel-edit-mark").addEventListener("click", close);

  modal.querySelector("#form-edit-mark").addEventListener("submit", (e) => {
    e.preventDefault();
    const newQuiz = Number(modal.querySelector("#edit-mark-quiz").value);
    const newSub = modal.querySelector("#edit-mark-sub").value;
    const newAtt = modal.querySelector("#edit-mark-att").value;
    const newPrev = modal.querySelector("#edit-mark-prev").value;
    const newPeer = modal.querySelector("#edit-mark-peer").value;
    const newPunctual = modal.querySelector("#edit-mark-punctual").value;
    const newNotes = modal.querySelector("#edit-mark-notes").value;

    const newCycle = modal.querySelector("#edit-mark-cycle").value.trim();

    const fields = {};
    if (newCycle && newCycle !== mark.cycle) fields.cycle = newCycle;
    if (newQuiz !== Number(mark.quizScore)) fields.quizScore = newQuiz;
    if (newSub !== mark.submission) fields.submission = newSub;
    if (newAtt !== mark.attendance) fields.attendance = newAtt;
    if (newPrev !== mark.previewDone) fields.previewDone = newPrev;
    if (newPeer !== mark.peerRating) fields.peerRating = newPeer;
    if (newPunctual !== mark.punctual) fields.punctual = newPunctual;
    if (newNotes !== mark.notes) fields.notes = newNotes;

    close();
    onSave(fields);
  });
}

export function openEditTaskModal(task, onSave) {
  const existing = document.getElementById("edit-task-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "edit-task-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700;">Edit Task</h3>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-edit-task">✕</button>
      </div>

      <form id="form-edit-task">
        <div class="form-group">
          <label class="form-label" for="edit-task-title">Task Title</label>
          <input type="text" id="edit-task-title" class="form-control" value="${esc(task.title)}" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-task-desc">Description / Instructions</label>
          <textarea id="edit-task-desc" class="form-control" rows="2" required>${esc(task.description || "")}</textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="form-group">
            <label class="form-label" for="edit-task-team">Assign To</label>
            <select id="edit-task-team" class="form-control">
              <option value="ALL" ${task.team === "ALL" ? "selected" : ""}>All Teams</option>
              <option value="Shehroz" ${task.team === "Shehroz" ? "selected" : ""}>Team Shehroz</option>
              <option value="Amina" ${task.team === "Amina" ? "selected" : ""}>Team Amina</option>
              <option value="Ayesha" ${task.team === "Ayesha" ? "selected" : ""}>Team Ayesha</option>
              <option value="Lareb" ${task.team === "Lareb" ? "selected" : ""}>Team Lareb</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-task-due">Due Date</label>
            <input type="date" id="edit-task-due" class="form-control" value="${esc(task.dueDate || "")}" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-task-file">Google Drive Link</label>
          <input type="url" id="edit-task-file" class="form-control" value="${esc(task.fileUrl || "")}" />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-edit-task">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-edit-task">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector("#btn-close-edit-task").addEventListener("click", close);
  modal.querySelector("#btn-cancel-edit-task").addEventListener("click", close);

  modal.querySelector("#form-edit-task").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = modal.querySelector("#edit-task-title").value;
    const description = modal.querySelector("#edit-task-desc").value;
    const team = modal.querySelector("#edit-task-team").value;
    const dueDate = modal.querySelector("#edit-task-due").value;
    const fileUrl = modal.querySelector("#edit-task-file").value;

    const fields = {};
    if (title !== task.title) fields.title = title;
    if (description !== task.description) fields.description = description;
    if (team !== task.team) fields.team = team;
    if (dueDate !== task.dueDate) fields.dueDate = dueDate;
    if (fileUrl !== task.fileUrl) fields.fileUrl = fileUrl;

    close();
    onSave(fields);
  });
}
