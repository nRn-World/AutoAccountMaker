const accountList = document.getElementById('accountList');
const emptyState = document.getElementById('emptyState');
const cryptoModal = document.getElementById('cryptoModal');
const modalTitle = document.getElementById('modalTitle');
const masterPassword = document.getElementById('masterPassword');
const modalMsg = document.getElementById('modalMsg');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const retentionSelect = document.getElementById('retentionLimit');
const vaultCount = document.getElementById('vaultCount');

let pendingAction = null;
let pendingFileContent = null;

// t() and translateError() come from i18n.js and are global. Do not declare
// them again, that throws a SyntaxError in global scope and kills the script.

function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function openModal(title, action) {
  modalTitle.textContent = title;
  masterPassword.value = '';
  modalMsg.textContent = '';
  modalMsg.className = 'msg';
  pendingAction = action;
  cryptoModal.classList.add('open');
  masterPassword.focus();
}

function closeModal() {
  cryptoModal.classList.remove('open');
  pendingAction = null;
  pendingFileContent = null;
}

/** Creates a button with a translated label. */
function button(text, className) {
  const b = document.createElement('button');
  b.textContent = text;
  if (className) b.className = className;
  return b;
}

function renderAccounts(accounts) {
  accountList.innerHTML = '';
  vaultCount.textContent = t('vault.retentionAccounts', accounts.length);

  if (!accounts.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  accounts.forEach((acc) => {
    const card = document.createElement('div');
    card.className = 'account-card';

    const site = document.createElement('div');
    site.className = 'site';
    site.textContent = acc.website;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const stamp = acc.createdAt
      ? new Date(acc.createdAt).toLocaleString(I18N.language)
      : '';
    meta.textContent = [stamp, acc.verified ? t('vault.verified') : t('vault.unverified')]
      .filter(Boolean)
      .join(' · ');

    const fields = document.createElement('div');
    [
      [t('vault.fieldEmail'), acc.email],
      [t('vault.fieldUsername'), acc.username || '—'],
    ].forEach(([label, value]) => {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const l = document.createElement('div');
      l.className = 'label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'value';
      v.textContent = value;
      wrap.appendChild(l);
      wrap.appendChild(v);
      fields.appendChild(wrap);
    });

    const pwField = document.createElement('div');
    pwField.className = 'field';
    const pwLabel = document.createElement('div');
    pwLabel.className = 'label';
    pwLabel.textContent = t('vault.fieldPassword');
    const pwValue = document.createElement('div');
    pwValue.className = 'value pw-hidden';
    pwValue.textContent = '••••••••';
    pwField.appendChild(pwLabel);
    pwField.appendChild(pwValue);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const showBtn = button(t('vault.btnShow'));
    const copyBtn = button(t('vault.btnCopy'));
    const delBtn = button(t('vault.btnDelete'), 'btn-danger');

    showBtn.addEventListener('click', () => {
      const hidden = pwValue.classList.toggle('pw-hidden');
      pwValue.textContent = hidden ? '••••••••' : acc.password || '';
      showBtn.textContent = hidden ? t('vault.btnShow') : t('vault.btnHide');
    });

    copyBtn.addEventListener('click', async () => {
      const text = t('vault.copiedTemplate', acc.website, acc.email, acc.password || '');
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* ignoreras */ }
        document.body.removeChild(ta);
      }
      copyBtn.textContent = t('vault.btnCopied');
      setTimeout(() => { copyBtn.textContent = t('vault.btnCopy'); }, 1500);
    });

    delBtn.addEventListener('click', async () => {
      if (!confirm(t('vault.confirmDelete'))) return;
      await sendMsg({ action: 'deleteAccount', id: acc.id });
      loadAccounts();
    });

    actions.appendChild(showBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);

    card.appendChild(site);
    card.appendChild(meta);
    card.appendChild(fields);
    card.appendChild(pwField);
    card.appendChild(actions);
    accountList.appendChild(card);
  });
}

async function loadAccounts() {
  const res = await sendMsg({ action: 'getAccounts' });
  renderAccounts(res?.accounts || []);
}

async function loadRetention() {
  const res = await sendMsg({ action: 'getSettings' });
  const limit = res?.settings?.retentionLimit || 10;
  if (retentionSelect) retentionSelect.value = String(limit);
}

// Save as soon as the limit changes, so the list is trimmed without another
// button press.
retentionSelect?.addEventListener('change', async () => {
  const settingsRes = await sendMsg({ action: 'getSettings' });
  const res = await sendMsg({
    action: 'saveSettings',
    settings: {
      ...(settingsRes?.settings || {}),
      retentionLimit: parseInt(retentionSelect.value, 10),
    },
  });
  if (res?.removed > 0) {
    logTrim(res.removed);
  }
  await loadAccounts();
});

function logTrim(removed) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.style.padding = '8px';
  div.textContent = t('vault.msgTrimmed', parseInt(retentionSelect?.value || '10', 10));
  const old = document.getElementById('trimNotice');
  if (old) old.remove();
  div.id = 'trimNotice';
  vaultCount.after(div);
}

document.getElementById('btnRefresh').addEventListener('click', loadAccounts);

// ---------------------------------------------------------------------------
// Export till CSV och PDF
//
// Both formats are NOT encrypted, unlike the .enc backup. Passwords are left
// out unless the box is deliberately ticked.
// ---------------------------------------------------------------------------

const includePasswordsBox = document.getElementById('includePasswords');

/** Builds the column list that applies right now. */
function exportColumns() {
  const cols = [
    { key: 'website', label: t('export.colWebsite') },
    { key: 'email', label: t('export.colEmail') },
    { key: 'username', label: t('export.colUsername') },
  ];
  if (includePasswordsBox?.checked) {
    cols.push({ key: 'password', label: t('export.colPassword') });
  }
  cols.push({ key: 'created', label: t('export.colCreated') });
  cols.push({ key: 'status', label: t('export.colStatus') });
  return cols;
}

function accountRows(acc) {
  return {
    website: acc.website || '',
    email: acc.email || '',
    username: acc.username || '',
    password: acc.password || '',
    created: acc.createdAt ? new Date(acc.createdAt).toLocaleString(I18N.language) : '',
    status: acc.verified ? t('vault.verified') : t('vault.unverified'),
  };
}

/**
 * CSV quoting. Without it, a value containing a comma, a quote, or a newline
 * destroys the whole file in Excel. E mail addresses rarely have any of
 * those, but usernames and website names can.
 */
function csvCell(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(accounts) {
  const cols = exportColumns();
  const lines = [cols.map((c) => csvCell(c.label)).join(',')];
  for (const acc of accounts) {
    const row = accountRows(acc);
    lines.push(cols.map((c) => csvCell(row[c.key])).join(','));
  }
  // BOM so Excel reads accented characters without mangled cells.
  return '\uFEFF' + lines.join('\r\n');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A short delay so the download starts before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

document.getElementById('btnExportCsv')?.addEventListener('click', async () => {
  const res = await sendMsg({ action: 'getAccounts' });
  const accounts = res?.accounts || [];
  if (!accounts.length) {
    showVaultMessage(t('export.nothingToExport'), 'err');
    return;
  }
  downloadBlob(
    buildCsv(accounts),
    `autoaccountmaker-accounts-${stamp()}.csv`,
    'text/csv;charset=utf-8'
  );
  showVaultMessage(t('export.csvOk', accounts.length), 'ok');
});

/**
 * PDF through the print dialog. We fill #printArea with a clean table and let
 * the print dialog do the work. The benefit is that the browser handles the
 * text, so no characters get mangled, which a hand written PDF generator
 * would risk.
 */
document.getElementById('btnExportPdf')?.addEventListener('click', async () => {
  const res = await sendMsg({ action: 'getAccounts' });
  const accounts = res?.accounts || [];
  const area = document.getElementById('printArea');
  if (!area) return;
  if (!accounts.length) {
    showVaultMessage(t('export.nothingToExport'), 'err');
    return;
  }

  const cols = exportColumns();
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = accounts.map((acc) => {
    const row = accountRows(acc);
    return '<tr>' + cols.map((c) => {
      const cls = ['password', 'email', 'username'].includes(c.key) ? ' class="mono"' : '';
      return `<td${cls}>${esc(row[c.key])}</td>`;
    }).join('') + '</tr>';
  }).join('');

  area.innerHTML = `
    <h1>AutoAccountMaker</h1>
    <p class="p-sub">${esc(t('export.pdfSubtitle', accounts.length))} — ${esc(new Date().toLocaleString(I18N.language))}</p>
    <table>
      <thead><tr>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="p-note">${esc(t('export.warning'))}</p>
  `;

  showVaultMessage(t('export.pdfHint'), 'ok');
  // Let the layout settle before the dialog opens.
  setTimeout(() => window.print(), 150);
});

function showVaultMessage(text, kind) {
  const el = document.getElementById('modalMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + (kind || '');
}

document.getElementById('btnExport').addEventListener('click', () => {
  openModal(t('vault.modalExport'), 'export');
});

document.getElementById('fileImport').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingFileContent = await file.text();
  openModal(t('vault.modalImport'), 'import');
  e.target.value = '';
});

modalCancel.addEventListener('click', closeModal);

modalConfirm.addEventListener('click', async () => {
  const pw = masterPassword.value;
  if (!pw) {
    modalMsg.textContent = t('vault.msgPasswordRequired');
    modalMsg.className = 'msg err';
    return;
  }

  if (pendingAction === 'export') {
    const res = await sendMsg({ action: 'exportEncrypted', password: pw });
    if (!res?.success) {
      modalMsg.textContent = translateError(res, 'vault.msgExportFailed');
      modalMsg.className = 'msg err';
      return;
    }
    const blob = new Blob([res.encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autaccountmaker-backup-${Date.now()}.enc`;
    a.click();
    URL.revokeObjectURL(url);
    modalMsg.textContent = t('vault.msgExportOk');
    modalMsg.className = 'msg ok';
    setTimeout(closeModal, 1200);
  }

  if (pendingAction === 'import') {
    const res = await sendMsg({ action: 'importEncrypted', encrypted: pendingFileContent, password: pw });
    if (!res?.success) {
      modalMsg.textContent = translateError(res, 'vault.msgImportFailed');
      modalMsg.className = 'msg err';
      return;
    }
    renderAccounts(res.accounts);
    modalMsg.textContent = t('vault.msgImportOk', res.accounts.length);
    modalMsg.className = 'msg ok';
    setTimeout(closeModal, 1200);
  }
});

document.getElementById('btnClearAll').addEventListener('click', async () => {
  if (!confirm(t('vault.confirmClearAll'))) return;
  await chrome.storage.local.set({ accounts: [] });
  loadAccounts();
});

(async function init() {
  await I18N.initI18n();
  await loadRetention();
  await loadAccounts();
})();
