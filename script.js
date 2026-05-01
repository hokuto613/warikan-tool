let members = JSON.parse(localStorage.getItem("members")) || [];
let payments = JSON.parse(localStorage.getItem("payments")) || [];
let paidChecks = JSON.parse(localStorage.getItem("paidChecks")) || {};

let resultMode = "minimum";
let historyVisible = false;
let editingPaymentIndex = null;

/* 自作モーダル */

function openModal(options) {
  return new Promise(resolve => {
    const overlay = document.getElementById("modalOverlay");
    const title = document.getElementById("modalTitle");
    const message = document.getElementById("modalMessage");
    const input = document.getElementById("modalInput");
    const okButton = document.getElementById("modalOkButton");
    const cancelButton = document.getElementById("modalCancelButton");

    title.textContent = options.title || "確認";
    message.textContent = options.message || "";
    okButton.textContent = options.okText || "OK";
    cancelButton.textContent = options.cancelText || "キャンセル";

    input.value = options.defaultValue || "";

    if (options.type === "prompt") {
      input.classList.remove("hidden");
    } else {
      input.classList.add("hidden");
    }

    if (options.type === "alert") {
      cancelButton.classList.add("hidden");
      okButton.textContent = options.okText || "閉じる";
    } else {
      cancelButton.classList.remove("hidden");
    }

    overlay.classList.remove("hidden");

    setTimeout(() => {
      if (options.type === "prompt") {
        input.focus();
        input.select();
      } else {
        okButton.focus();
      }
    }, 50);

    function cleanup(value) {
      overlay.classList.add("hidden");
      okButton.onclick = null;
      cancelButton.onclick = null;
      input.onkeydown = null;
      resolve(value);
    }

    okButton.onclick = () => {
      if (options.type === "prompt") {
        cleanup(input.value);
      } else {
        cleanup(true);
      }
    };

    cancelButton.onclick = () => {
      if (options.type === "prompt") {
        cleanup(null);
      } else {
        cleanup(false);
      }
    };

    input.onkeydown = event => {
      if (event.key === "Enter") {
        cleanup(input.value);
      }
    };
  });
}

function showMessage(message, title = "確認") {
  return openModal({
    type: "alert",
    title,
    message,
    okText: "閉じる"
  });
}

function showConfirm(message, title = "確認") {
  return openModal({
    type: "confirm",
    title,
    message,
    okText: "OK",
    cancelText: "キャンセル"
  });
}

function showPrompt(message, defaultValue = "", title = "入力") {
  return openModal({
    type: "prompt",
    title,
    message,
    defaultValue,
    okText: "OK",
    cancelText: "キャンセル"
  });
}

/* 共通 */

function saveData() {
  localStorage.setItem("members", JSON.stringify(members));
  localStorage.setItem("payments", JSON.stringify(payments));
  localStorage.setItem("paidChecks", JSON.stringify(paidChecks));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1600);
}

function formatYen(value) {
  return `${Math.round(value).toLocaleString()}円`;
}

function resetPaidChecks() {
  paidChecks = {};
  localStorage.setItem("paidChecks", JSON.stringify(paidChecks));
}

/* メンバー */

async function addMember() {
  const nameInput = document.getElementById("memberName");
  const name = nameInput.value.trim();

  if (!name) {
    await showMessage("名前を入力してください");
    return;
  }

  if (members.includes(name)) {
    await showMessage("同じ名前のメンバーがいます");
    return;
  }

  members.push(name);
  nameInput.value = "";

  saveData();
  render();
  showToast("メンバーを追加しました");
}

async function renameMember(oldName) {
  const newName = await showPrompt("新しい名前を入力してください", oldName, "名前変更");

  if (newName === null) return;

  const trimmed = newName.trim();

  if (!trimmed) {
    await showMessage("名前を入力してください");
    return;
  }

  if (trimmed !== oldName && members.includes(trimmed)) {
    await showMessage("同じ名前のメンバーがいます");
    return;
  }

  members = members.map(member => member === oldName ? trimmed : member);

  payments = payments.map(payment => {
    return {
      ...payment,
      payer: payment.payer === oldName ? trimmed : payment.payer,
      targets: payment.targets.map(target => target === oldName ? trimmed : target)
    };
  });

  resetPaidChecks();
  saveData();
  render();
  showToast("メンバー名を変更しました");
}

async function deleteMember(name) {
  const message =
    `${name} を削除しますか？\n\n` +
    `・この人が払った支払い履歴は削除されます\n` +
    `・対象メンバーからも除外されます\n` +
    `・支払い済みチェックはリセットされます`;

  const ok = await showConfirm(message, "メンバー削除");
  if (!ok) return;

  members = members.filter(member => member !== name);

  payments = payments
    .filter(payment => payment.payer !== name)
    .map(payment => {
      return {
        ...payment,
        targets: payment.targets.filter(target => target !== name)
      };
    })
    .filter(payment => payment.targets.length > 0);

  resetPaidChecks();
  saveData();
  render();
  showToast("メンバーを削除しました");
}

/* 支払い登録・編集 */

async function getPaymentFormData() {
  const title = document.getElementById("paymentTitle").value.trim() || "無題";
  const payer = document.getElementById("payer").value;
  const amount = Number(document.getElementById("amount").value);
  const targets = Array.from(document.querySelectorAll(".target:checked")).map(x => x.value);

  if (members.length === 0) {
    await showMessage("先にメンバーを登録してください");
    return null;
  }

  if (!payer) {
    await showMessage("払った人を選択してください");
    return null;
  }

  if (!amount || amount <= 0) {
    await showMessage("金額を入力してください");
    return null;
  }

  if (targets.length === 0) {
    await showMessage("対象メンバーを選択してください");
    return null;
  }

  return {
    title,
    payer,
    amount,
    targets
  };
}

async function savePayment() {
  const data = await getPaymentFormData();
  if (!data) return;

  if (editingPaymentIndex === null) {
    payments.push(data);
    showToast("支払いを登録しました");
  } else {
    payments[editingPaymentIndex] = data;
    editingPaymentIndex = null;
    showToast("支払い履歴を更新しました");
  }

  resetPaidChecks();
  clearPaymentInputsOnly();
  saveData();
  render();
}

function editPayment(index) {
  const payment = payments[index];
  if (!payment) return;

  editingPaymentIndex = index;
  render();

  document.getElementById("paymentTitle").value = payment.title || "無題";
  document.getElementById("payer").value = payment.payer;
  document.getElementById("amount").value = payment.amount;

  document.querySelectorAll(".target").forEach(checkbox => {
    checkbox.checked = payment.targets.includes(checkbox.value);
  });

  document.getElementById("paymentFormTitle").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  showToast("編集モードにしました");
}

function cancelPaymentEdit() {
  editingPaymentIndex = null;
  clearPaymentInputsOnly();
  render();
  showToast("編集をキャンセルしました");
}

async function deletePayment(index) {
  const payment = payments[index];
  if (!payment) return;

  const message =
    `【${payment.title || "無題"}】\n` +
    `${payment.payer} が ${formatYen(payment.amount)} 支払い\n` +
    `対象：${payment.targets.join("、")}\n\n` +
    `この履歴を削除しますか？`;

  const ok = await showConfirm(message, "履歴削除");
  if (!ok) return;

  payments.splice(index, 1);

  if (editingPaymentIndex === index) {
    editingPaymentIndex = null;
    clearPaymentInputsOnly();
  }

  resetPaidChecks();
  saveData();
  render();
  showToast("履歴を削除しました");
}

/* 計算 */

function getRawDebts() {
  const debts = {};

  members.forEach(from => {
    debts[from] = {};
    members.forEach(to => {
      if (from !== to) {
        debts[from][to] = 0;
      }
    });
  });

  payments.forEach(payment => {
    const share = payment.amount / payment.targets.length;

    payment.targets.forEach(target => {
      if (target === payment.payer) return;

      if (!debts[target]) debts[target] = {};
      if (!debts[target][payment.payer]) debts[target][payment.payer] = 0;

      debts[target][payment.payer] += share;
    });
  });

  return debts;
}

function calculateHistoryMode() {
  const debts = getRawDebts();
  const results = [];
  const processed = new Set();

  members.forEach(a => {
    members.forEach(b => {
      if (a === b) return;

      const key1 = `${a}->${b}`;
      const key2 = `${b}->${a}`;

      if (processed.has(key1) || processed.has(key2)) return;

      const ab = debts[a]?.[b] || 0;
      const ba = debts[b]?.[a] || 0;
      const diff = Math.round(ab - ba);

      if (diff > 0) {
        results.push({ from: a, to: b, amount: diff });
      } else if (diff < 0) {
        results.push({ from: b, to: a, amount: Math.abs(diff) });
      }

      processed.add(key1);
      processed.add(key2);
    });
  });

  return results;
}

function calculateMinimumMode() {
  const balance = {};

  members.forEach(member => {
    balance[member] = 0;
  });

  payments.forEach(payment => {
    const share = payment.amount / payment.targets.length;

    balance[payment.payer] += payment.amount;

    payment.targets.forEach(target => {
      balance[target] -= share;
    });
  });

  const creditors = [];
  const debtors = [];

  Object.keys(balance).forEach(name => {
    const value = Math.round(balance[name]);

    if (value > 0) creditors.push({ name, amount: value });
    if (value < 0) debtors.push({ name, amount: -value });
  });

  const results = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const payAmount = Math.min(debtors[i].amount, creditors[j].amount);

    results.push({
      from: debtors[i].name,
      to: creditors[j].name,
      amount: payAmount
    });

    debtors[i].amount -= payAmount;
    creditors[j].amount -= payAmount;

    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return results;
}

function resultToText(result) {
  return `${result.from} → ${result.to}：${formatYen(result.amount)}`;
}

function getResultKey(result) {
  return `${result.from}->${result.to}:${Math.round(result.amount)}`;
}

/* 支払い済みチェック */

function togglePaidCheck(key, checked) {
  if (checked) {
    paidChecks[key] = true;
  } else {
    delete paidChecks[key];
  }

  saveData();
  renderResults();
}

async function clearPaidChecks() {
  const ok = await showConfirm("支払い済みチェックをすべてクリアしますか？", "チェックをクリア");
  if (!ok) return;

  resetPaidChecks();
  renderResults();
  showToast("支払い済みチェックをクリアしました");
}

/* 表示切替 */

function toggleResultMode() {
  resultMode = resultMode === "minimum" ? "history" : "minimum";
  render();
  showToast(resultMode === "minimum" ? "最小精算に切替" : "履歴反映に切替");
}

function toggleHistory() {
  historyVisible = !historyVisible;
  render();
}

/* 描画 */

function renderMembers() {
  const memberList = document.getElementById("memberList");
  const payer = document.getElementById("payer");
  const targetMembers = document.getElementById("targetMembers");

  memberList.innerHTML = "";
  payer.innerHTML = "";
  targetMembers.innerHTML = "";

  members.forEach(member => {
    const item = document.createElement("div");
    item.className = "member-item";

    const name = document.createElement("div");
    name.className = "member-name";
    name.textContent = member;

    const actions = document.createElement("div");
    actions.className = "member-actions";

    const renameButton = document.createElement("button");
    renameButton.className = "sub";
    renameButton.textContent = "名前変更";
    renameButton.onclick = () => renameMember(member);

    const deleteButton = document.createElement("button");
    deleteButton.className = "member-delete";
    deleteButton.textContent = "削除";
    deleteButton.onclick = () => deleteMember(member);

    actions.appendChild(renameButton);
    actions.appendChild(deleteButton);

    item.appendChild(name);
    item.appendChild(actions);
    memberList.appendChild(item);

    const option = document.createElement("option");
    option.value = member;
    option.textContent = member;
    payer.appendChild(option);

    const label = document.createElement("label");
    label.className = "member-check";

    const checkbox = document.createElement("input");
    checkbox.className = "target";
    checkbox.type = "checkbox";
    checkbox.value = member;
    checkbox.checked = true;

    const span = document.createElement("span");
    span.textContent = member;

    label.appendChild(checkbox);
    label.appendChild(span);
    targetMembers.appendChild(label);
  });
}

function renderPaymentFormState() {
  const title = document.getElementById("paymentFormTitle");
  const submitButton = document.getElementById("paymentSubmitButton");
  const cancelButton = document.getElementById("paymentCancelButton");

  if (editingPaymentIndex === null) {
    title.textContent = "支払い登録";
    submitButton.textContent = "支払い登録";
    cancelButton.classList.add("hidden");
  } else {
    title.textContent = "支払い履歴を編集";
    submitButton.textContent = "編集を保存";
    cancelButton.classList.remove("hidden");
  }
}

function renderResults() {
  const resultList = document.getElementById("resultList");
  const resultModeText = document.getElementById("resultModeText");
  const toggleButton = document.querySelector("button[onclick='toggleResultMode()']");

  resultList.innerHTML = "";

  let results;

  if (resultMode === "minimum") {
    resultModeText.textContent = "最小精算方式";
    toggleButton.textContent = "履歴反映方式に切替";
    results = calculateMinimumMode();
  } else {
    resultModeText.textContent = "履歴反映方式";
    toggleButton.textContent = "最小精算方式に切替";
    results = calculateHistoryMode();
  }

  if (results.length === 0) {
    const li = document.createElement("li");
    li.className = "result-item";
    li.textContent = "精算はありません";
    resultList.appendChild(li);
    return;
  }

  results.forEach(result => {
    const key = getResultKey(result);
    const checked = !!paidChecks[key];

    const li = document.createElement("li");
    li.className = "result-item";

    const row = document.createElement("div");
    row.className = "result-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.onchange = () => togglePaidCheck(key, checkbox.checked);

    const text = document.createElement("div");
    text.className = checked ? "result-text result-paid" : "result-text";
    text.textContent = resultToText(result);

    row.appendChild(checkbox);
    row.appendChild(text);
    li.appendChild(row);

    resultList.appendChild(li);
  });
}

function renderHistory() {
  const historyArea = document.getElementById("historyArea");
  const historyList = document.getElementById("historyList");
  const historyButton = document.querySelector("button[onclick='toggleHistory()']");

  historyList.innerHTML = "";

  if (historyVisible) {
    historyArea.classList.remove("hidden");
    historyButton.textContent = "履歴を非表示";
  } else {
    historyArea.classList.add("hidden");
    historyButton.textContent = "履歴を表示";
    return;
  }

  if (payments.length === 0) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "履歴はありません";
    historyList.appendChild(li);
    return;
  }

  payments.forEach((payment, index) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = payment.title || "無題";

    const main = document.createElement("div");
    main.className = "history-main";
    main.textContent = `${index + 1}. ${payment.payer} が ${formatYen(payment.amount)} 支払い`;

    const sub = document.createElement("div");
    sub.className = "history-sub";
    sub.textContent = `対象：${payment.targets.join("、")}`;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const editButton = document.createElement("button");
    editButton.className = "sub";
    editButton.textContent = "編集";
    editButton.onclick = () => editPayment(index);

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.textContent = "削除";
    deleteButton.onclick = () => deletePayment(index);

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    li.appendChild(title);
    li.appendChild(main);
    li.appendChild(sub);
    li.appendChild(actions);

    historyList.appendChild(li);
  });
}

function render() {
  renderMembers();
  renderPaymentFormState();
  renderResults();
  renderHistory();
}

/* クリア */

function clearPaymentInputsOnly() {
  document.getElementById("paymentTitle").value = "";
  document.getElementById("amount").value = "";

  document.querySelectorAll(".target").forEach(checkbox => {
    checkbox.checked = true;
  });
}

function clearInput() {
  editingPaymentIndex = null;
  document.getElementById("memberName").value = "";
  clearPaymentInputsOnly();
  renderPaymentFormState();
  showToast("入力をクリアしました");
}

async function clearPayments() {
  const ok = await showConfirm("支払い履歴だけ削除しますか？", "支払い履歴クリア");
  if (!ok) return;

  payments = [];
  editingPaymentIndex = null;
  resetPaidChecks();
  saveData();
  render();
  showToast("支払い履歴を削除しました");
}

async function clearAll() {
  const ok = await showConfirm("メンバーも支払い履歴も全て削除しますか？", "全削除");
  if (!ok) return;

  members = [];
  payments = [];
  paidChecks = {};
  editingPaymentIndex = null;

  localStorage.removeItem("members");
  localStorage.removeItem("payments");
  localStorage.removeItem("paidChecks");

  render();
  showToast("全データを削除しました");
}

/* 共有テキスト */

function encodeData(data) {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeData(text) {
  const json = decodeURIComponent(escape(atob(text)));
  return JSON.parse(json);
}

function generateShareText() {
  const minimumResults = calculateMinimumMode();
  const historyResults = calculateHistoryMode();

  const data = {
    version: 2,
    members,
    payments,
    paidChecks
  };

  const encoded = encodeData(data);

  let text = "";

  text += "【割り勘メモ】\n\n";

  text += "■メンバー\n";
  text += members.length ? members.join("、") : "なし";
  text += "\n\n";

  text += "■支払い履歴\n";
  if (payments.length === 0) {
    text += "なし\n";
  } else {
    payments.forEach((payment, index) => {
      text += `${index + 1}. 【${payment.title || "無題"}】${payment.payer} が ${formatYen(payment.amount)} 支払い\n`;
      text += `   対象：${payment.targets.join("、")}\n`;
    });
  }

  text += "\n■最小精算\n";
  if (minimumResults.length === 0) {
    text += "精算はありません\n";
  } else {
    minimumResults.forEach(result => {
      const key = `minimum:${result.from}->${result.to}:${Math.round(result.amount)}`;
      const mark = paidChecks[key] ? "☑" : "□";
      text += `${mark} ${resultToText(result)}\n`;
    });
  }

  text += "\n■履歴反映方式\n";
  if (historyResults.length === 0) {
    text += "精算はありません\n";
  } else {
    historyResults.forEach(result => {
      const key = `history:${result.from}->${result.to}:${Math.round(result.amount)}`;
      const mark = paidChecks[key] ? "☑" : "□";
      text += `${mark} ${resultToText(result)}\n`;
    });
  }

  text += "\n----\n";
  text += "この下は割り勘ツール読み込み用データです\n";
  text += "WARIKAN_DATA_START\n";
  text += encoded + "\n";
  text += "WARIKAN_DATA_END\n";

  document.getElementById("shareText").value = text;
  showToast("共有テキストを作成しました");
}

async function copyShareText() {
  const shareText = document.getElementById("shareText");

  if (!shareText.value.trim()) {
    generateShareText();
  }

  shareText.select();
  shareText.setSelectionRange(0, 999999);

  try {
    await navigator.clipboard.writeText(shareText.value);
    showToast("コピーしました");
  } catch (e) {
    document.execCommand("copy");
    showToast("コピーしました");
  }
}

function clearShareText() {
  document.getElementById("shareText").value = "";
  showToast("共有テキストをクリアしました");
}

async function importShareText() {
  const text = document.getElementById("shareText").value.trim();

  if (!text) {
    await showMessage("読み込むテキストを貼り付けてください");
    return;
  }

  const match = text.match(/WARIKAN_DATA_START\s*([\s\S]*?)\s*WARIKAN_DATA_END/);

  if (!match) {
    await showMessage("読み込み用データが見つかりません");
    return;
  }

  try {
    const data = decodeData(match[1].trim());

    if (!Array.isArray(data.members) || !Array.isArray(data.payments)) {
      await showMessage("データ形式が正しくありません");
      return;
    }

    members = data.members;
    payments = data.payments.map(payment => {
      return {
        title: payment.title || "無題",
        payer: payment.payer,
        amount: Number(payment.amount),
        targets: payment.targets || []
      };
    });

    paidChecks = data.paidChecks || {};
    editingPaymentIndex = null;

    saveData();
    render();
    showToast("テキストから読み込みました");
  } catch (e) {
    await showMessage("読み込みに失敗しました");
  }
}

render();
