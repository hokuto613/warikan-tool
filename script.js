let members = JSON.parse(localStorage.getItem("members")) || [];
let payments = JSON.parse(localStorage.getItem("payments")) || [];
let resultMode = "minimum";
let historyVisible = false;

function saveData() {
  localStorage.setItem("members", JSON.stringify(members));
  localStorage.setItem("payments", JSON.stringify(payments));
}

function addMember() {
  const nameInput = document.getElementById("memberName");
  const name = nameInput.value.trim();

  if (!name) {
    alert("名前を入力してください");
    return;
  }

  if (members.includes(name)) {
    alert("同じ名前のメンバーがいます");
    return;
  }

  members.push(name);
  nameInput.value = "";

  saveData();
  render();
}

function addPayment() {
  const payer = document.getElementById("payer").value;
  const amount = Number(document.getElementById("amount").value);
  const targets = Array.from(document.querySelectorAll(".target:checked")).map(x => x.value);

  if (members.length === 0) {
    alert("先にメンバーを登録してください");
    return;
  }

  if (!payer) {
    alert("払った人を選択してください");
    return;
  }

  if (!amount || amount <= 0) {
    alert("金額を入力してください");
    return;
  }

  if (targets.length === 0) {
    alert("対象メンバーを選択してください");
    return;
  }

  payments.push({ payer, amount, targets });

  document.getElementById("amount").value = "";

  saveData();
  render();
}

function deletePayment(index) {
  const payment = payments[index];

  if (!payment) return;

  const message =
    `${payment.payer} が ${payment.amount}円 支払い\n` +
    `対象：${payment.targets.join("、")}\n\n` +
    `この履歴を削除しますか？`;

  if (!confirm(message)) return;

  payments.splice(index, 1);
  saveData();
  render();
}

function getRawDebts() {
  const debts = {};

  members.forEach(from => {
    debts[from] = {};
    members.forEach(to => {
      if (from !== to) debts[from][to] = 0;
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
        results.push(`${a} → ${b}：${diff}円`);
      } else if (diff < 0) {
        results.push(`${b} → ${a}：${Math.abs(diff)}円`);
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

    results.push(`${debtors[i].name} → ${creditors[j].name}：${payAmount}円`);

    debtors[i].amount -= payAmount;
    creditors[j].amount -= payAmount;

    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return results;
}

function toggleResultMode() {
  resultMode = resultMode === "minimum" ? "history" : "minimum";
  render();
}

function toggleHistory() {
  historyVisible = !historyVisible;
  render();
}

function renderMembers() {
  const memberList = document.getElementById("memberList");
  const payer = document.getElementById("payer");
  const targetMembers = document.getElementById("targetMembers");

  memberList.innerHTML = "";
  payer.innerHTML = "";
  targetMembers.innerHTML = "";

  members.forEach(member => {
    const li = document.createElement("li");
    li.textContent = member;
    memberList.appendChild(li);

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
    li.textContent = "精算はありません";
    resultList.appendChild(li);
  } else {
    results.forEach(result => {
      const li = document.createElement("li");
      li.textContent = result;
      resultList.appendChild(li);
    });
  }
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
    li.textContent = "履歴はありません";
    historyList.appendChild(li);
    return;
  }

  payments.forEach((payment, index) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const main = document.createElement("div");
    main.className = "history-main";
    main.textContent = `${index + 1}. ${payment.payer} が ${payment.amount}円 支払い`;

    const sub = document.createElement("div");
    sub.className = "history-sub";
    sub.textContent = `対象：${payment.targets.join("、")}`;

    const deleteButton = document.createElement("button");
    deleteButton.className = "history-delete";
    deleteButton.textContent = "この履歴を削除";
    deleteButton.onclick = () => deletePayment(index);

    li.appendChild(main);
    li.appendChild(sub);
    li.appendChild(deleteButton);

    historyList.appendChild(li);
  });
}

function render() {
  renderMembers();
  renderResults();
  renderHistory();
}

function clearInput() {
  document.getElementById("memberName").value = "";
  document.getElementById("amount").value = "";

  document.querySelectorAll(".target").forEach(checkbox => {
    checkbox.checked = true;
  });
}

function clearPayments() {
  if (!confirm("支払い履歴だけ削除しますか？")) return;

  payments = [];
  saveData();
  render();
}

function clearAll() {
  if (!confirm("メンバーも支払い履歴も全て削除しますか？")) return;

  members = [];
  payments = [];
  saveData();
  render();
}

function exportCSV() {
  let csv = "type,payer,amount,targets\n";

  payments.forEach(payment => {
    csv += `payment,${payment.payer},${payment.amount},"${payment.targets.join("|")}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "warikan-data.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).slice(1);

    payments = [];

    lines.forEach(line => {
      if (!line.trim()) return;

      const cols = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
      if (!cols || cols.length < 4) return;

      const payer = cols[1].replaceAll('"', "");
      const amount = Number(cols[2].replaceAll('"', ""));
      const targets = cols[3].replaceAll('"', "").split("|");

      payments.push({ payer, amount, targets });

      if (!members.includes(payer)) members.push(payer);

      targets.forEach(target => {
        if (!members.includes(target)) members.push(target);
      });
    });

    saveData();
    render();
  };

  reader.readAsText(file);
}

render();
