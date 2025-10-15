let token = null;
let username = null;
let session = null; // For MFA/login sessions

// Helper: show popup messages
function showPopup(msg, success) {
  const popup = document.createElement("div");
  popup.textContent = msg;
  popup.style.position = "fixed";
  popup.style.top = "20px";
  popup.style.right = "20px";
  popup.style.padding = "10px 20px";
  popup.style.backgroundColor = success ? "green" : "red";
  popup.style.color = "white";
  popup.style.borderRadius = "5px";
  popup.style.zIndex = "1000";
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3000);
}

// Show sections after login/signup
function showUserSections() {
  document.getElementById("upload-section").style.display = "block";
  document.getElementById("process-section").style.display = "block";
  document.getElementById("images-section").style.display = "block";
  document.getElementById("login-section").style.display = "none";
  document.getElementById("signup-section").style.display = "none";

  const greeting = document.getElementById("user-greeting");
  greeting.textContent = `Welcome, ${username}!`;
  greeting.style.display = "block";
}

// Validate password
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) errors.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("one lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("one number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("one special character");
  return errors;
}

// Load images from server
async function loadImages() {
  if (!token) return;

  try {
    const res = await fetch("/images", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to load images");

    const data = await res.json();
    const gallery = document.getElementById("images-gallery");
    gallery.innerHTML = "";

    if (!data.images || data.images.length === 0) {
      gallery.innerHTML = "<p>No images uploaded yet.</p>";
      return;
    }

    data.images.forEach(img => {
      const container = document.createElement("div");
      container.className = "image-item";
      container.style.display = "inline-block";
      container.style.margin = "10px";
      container.style.textAlign = "center";

      // Image thumbnail (click to autofill filename)
      const imgEl = document.createElement("img");
      imgEl.src = img.s3Url;
      imgEl.alt = img.id;
      imgEl.style.width = "150px";
      imgEl.style.height = "150px";
      imgEl.style.objectFit = "cover";
      imgEl.style.cursor = "pointer";
      imgEl.addEventListener("click", () => {
        document.getElementById("filename").value = img.id;
      });

      // Download button
      const downloadBtn = document.createElement("button");
      downloadBtn.textContent = "Download";
      downloadBtn.style.display = "block";
      downloadBtn.style.marginTop = "5px";
      downloadBtn.addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = img.s3Url;
        a.download = img.id;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

      // Info
      const info = document.createElement("p");
      info.innerHTML = `
        <strong>Filter:</strong> ${img.filter || "none"}<br>
        <strong>Type:</strong> ${img.type || "uploaded"}<br>
        <strong>Uploaded:</strong> ${img.uploadedAt || "N/A"}
      `;
      info.style.fontSize = "12px";

      container.appendChild(imgEl);
      container.appendChild(downloadBtn);
      container.appendChild(info);

      gallery.appendChild(container);
    });
  } catch (err) {
    console.error(err);
    document.getElementById("images-gallery").innerHTML = "<p>Failed to load images.</p>";
  }
}

// Sign-up
document.getElementById("signup-btn").addEventListener("click", async () => {
  username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;
  const email = document.getElementById("signup-email").value;

  // Validate password
  const pwErrors = validatePassword(password);
  if (pwErrors.length > 0) {
    document.getElementById("signup-status").textContent =
      "Password must contain: " + pwErrors.join(", ");
    return;
  }

  try {
    const res = await fetch("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, email })
    });

    const data = await res.json();
    const signupStatus = document.getElementById("signup-status");

    if (res.ok) {
      signupStatus.textContent = "Sign-up successful! Enter confirmation code below.";

      let confirmContainer = document.getElementById("confirm-container");
      if (!confirmContainer) {
        confirmContainer = document.createElement("div");
        confirmContainer.id = "confirm-container";

        const label = document.createElement("p");
        label.textContent = `Confirmation for username: ${username}`;

        const codeInput = document.createElement("input");
        codeInput.id = "confirmation-code";
        codeInput.placeholder = "Enter confirmation code";

        const confirmBtn = document.createElement("button");
        confirmBtn.id = "confirm-btn";
        confirmBtn.textContent = "Confirm";

        confirmContainer.appendChild(label);
        confirmContainer.appendChild(codeInput);
        confirmContainer.appendChild(confirmBtn);
        signupStatus.parentNode.appendChild(confirmContainer);

        confirmBtn.addEventListener("click", async () => {
          const code = document.getElementById("confirmation-code").value;
          try {
            const confirmRes = await fetch("/auth/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, confirmationCode: code })
            });

            const confirmData = await confirmRes.json();
            if (confirmRes.ok) {
              showPopup("User confirmed! You can now log in.", true);
              confirmContainer.remove();
            } else {
              showPopup(confirmData.error || "Confirmation failed", false);
            }
          } catch {
            showPopup("Confirmation failed", false);
          }
        });
      }

    } else {
      signupStatus.textContent = data.error || "Sign-up failed";
    }
  } catch (err) {
    document.getElementById("signup-status").textContent = "Sign-up failed: " + err.message;
  }
});

// Login
document.getElementById("login-btn").addEventListener("click", async () => {
  username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.challengeName) {
      session = data.session;

      let confirmContainer = document.getElementById("login-confirm-container");
      if (!confirmContainer) {
        confirmContainer = document.createElement("div");
        confirmContainer.id = "login-confirm-container";

        const label = document.createElement("p");
        label.textContent = "Enter the authentication code sent to your email:";

        const codeInput = document.createElement("input");
        codeInput.id = "login-authentication-code";
        codeInput.placeholder = "Authentication code";

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Confirm";

        confirmContainer.appendChild(label);
        confirmContainer.appendChild(codeInput);
        confirmContainer.appendChild(confirmBtn);
        document.getElementById("login-section").appendChild(confirmContainer);

        confirmBtn.addEventListener("click", async () => {
          const code = document.getElementById("login-authentication-code").value;

          const confirmRes = await fetch("/auth/confirm-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              confirmationCode: code,
              session: session,
              challengeName: data.challengeName
            })
          });

          const confirmData = await confirmRes.json();

          if (confirmRes.ok) {
            token = confirmData.IdToken;
            showPopup("Login successful!", true);
            showUserSections();
            loadImages();
            confirmContainer.remove();
          } else {
            showPopup(confirmData.error || "Authentication failed", false);
          }
        });
      }

    } else if (data.IdToken) {
      token = data.IdToken;
      showPopup("Login successful!", true);
      showUserSections();
      loadImages();
    } else {
      showPopup(data.error || "Login failed", false);
    }

  } catch (err) {
    showPopup("Login failed: " + err.message, false);
  }
});

// Upload
document.getElementById("upload-btn").addEventListener("click", async () => {
  const fileInput = document.getElementById("image-file");
  if (!fileInput.files.length) return showPopup("Select a file first!", false);

  const formData = new FormData();
  formData.append("image", fileInput.files[0]);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (res.ok) {
      showPopup("Upload successful!", true);
      loadImages();
    } else showPopup(data.error || "Upload failed", false);
  } catch {
    showPopup("Upload failed", false);
  }
});

// Process
document.getElementById("process-btn").addEventListener("click", async () => {
  const filename = document.getElementById("filename").value;
  const filter = document.getElementById("filter-select").value;
  if (!filename) return showPopup("Select an image first!", false);

  try {
    const res = await fetch(`/process/${filename}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ filter })
    });

    const data = await res.json();
    if (res.ok) {
      showPopup("Processing successful!", true);
      loadImages();
    } else showPopup(data.error || "Processing failed", false);
  } catch {
    showPopup("Processing failed", false);
  }
});
