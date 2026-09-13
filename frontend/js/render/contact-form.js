/* ============================================================
   CONTACT FORM — validation, submit state, toast confirmation
   ============================================================ */

function initContact() {
  const btn = document.getElementById("contact-submit");
  if (!btn) return;
  const inputIds = ["c-name", "c-email", "c-message"];
  const successMessage = (NOVIQ_CONTENT && NOVIQ_CONTENT.contact && NOVIQ_CONTENT.contact.successMessage) || 'Message Sent!';
  const ctaLabel = (NOVIQ_CONTENT && NOVIQ_CONTENT.contact && NOVIQ_CONTENT.contact.ctaLabel) || 'Send Message';

  function clearErrors() {
    inputIds.forEach(id => document.getElementById(id).classList.remove("error"));
  }

  btn.addEventListener("click", () => {
    clearErrors();
    const name = document.getElementById("c-name").value.trim();
    const email = document.getElementById("c-email").value.trim();
    const msg = document.getElementById("c-message").value.trim();

    let valid = true;
    if (!name) { document.getElementById("c-name").classList.add("error"); valid = false; }
    if (!email || !email.includes("@")) { document.getElementById("c-email").classList.add("error"); valid = false; }
    if (!msg) { document.getElementById("c-message").classList.add("error"); valid = false; }
    if (!valid) {
      btn.classList.add('noviq-shake');
      setTimeout(() => btn.classList.remove('noviq-shake'), 500);
      return;
    }

    btn.disabled = true;
    const spinner = document.createElement('span');
    spinner.className = 'noviq-spinner';
    btn.textContent = '';
    btn.appendChild(spinner);
    btn.appendChild(document.createTextNode(' ' + t('Sending...')));

    fetch(NoviqAPI.url('/contact'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, company: document.getElementById("c-company").value.trim(), message: msg }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          btn.textContent = ctaLabel;
          btn.disabled = false;
          showToast(data.error);
          return;
        }
        btn.textContent = '';
        btn.appendChild(document.createTextNode(t('Message Sent') + ' '));
        const check = document.createElement('span');
        check.style.fontSize = '16px';
        check.textContent = '\u2713';
        btn.appendChild(check);
        btn.style.background = "linear-gradient(135deg, var(--success), #16a34a)";
        inputIds.forEach(id => document.getElementById(id).value = "");
        clearErrors();
        showToast(successMessage);
        setTimeout(() => {
          btn.textContent = ctaLabel;
          btn.disabled = false;
          btn.style.background = "";
        }, 2800);
      })
      .catch(() => {
        btn.textContent = ctaLabel;
        btn.disabled = false;
        showToast(t('Failed to send. Please try again.'));
      });
  });

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => el.classList.remove("error"));
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" && id !== "c-message") btn.click();
    });
  });
}
