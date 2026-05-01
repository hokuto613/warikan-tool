function render() {
  const memberList = document.getElementById("memberList");
  const payer = document.getElementById("payer");
  const targetMembers = document.getElementById("targetMembers");
  const resultList = document.getElementById("resultList");

  memberList.innerHTML = "";
  payer.innerHTML = "";
  targetMembers.innerHTML = "";
  resultList.innerHTML = "";

  members.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m;
    memberList.appendChild(li);

    const option = document.createElement("option");
    option.value = m;
    option.textContent = m;
    payer.appendChild(option);

    const label = document.createElement("label");
    label.className = "member-check";

    const checkbox = document.createElement("input");
    checkbox.className = "target";
    checkbox.type = "checkbox";
    checkbox.value = m;
    checkbox.checked = true;

    const span = document.createElement("span");
    span.textContent = m;

    label.appendChild(checkbox);
    label.appendChild(span);
    targetMembers.appendChild(label);
  });

  calculate().forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    resultList.appendChild(li);
  });
}
