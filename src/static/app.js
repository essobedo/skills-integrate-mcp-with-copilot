document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userMenuPanel = document.getElementById("user-menu-panel");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login");
  const teacherLockMessage = document.getElementById("teacher-lock-message");

  const authState = {
    token: localStorage.getItem("teacherToken") || "",
    username: "",
  };

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function renderAuthState() {
    const isAuthenticated = Boolean(authState.token && authState.username);

    authStatus.textContent = isAuthenticated
      ? `Teacher: ${authState.username}`
      : "Not logged in";

    loginButton.classList.toggle("hidden", isAuthenticated);
    logoutButton.classList.toggle("hidden", !isAuthenticated);
    signupForm.classList.toggle("hidden", !isAuthenticated);
    teacherLockMessage.classList.toggle("hidden", isAuthenticated);
  }

  async function syncSession() {
    if (!authState.token) {
      authState.username = "";
      renderAuthState();
      return;
    }

    try {
      const response = await fetch("/auth/session", {
        headers: {
          "X-Teacher-Token": authState.token,
        },
      });

      const result = await response.json();

      if (result.authenticated) {
        authState.username = result.username;
      } else {
        authState.token = "";
        authState.username = "";
        localStorage.removeItem("teacherToken");
      }
    } catch (error) {
      authState.token = "";
      authState.username = "";
      localStorage.removeItem("teacherToken");
      console.error("Error validating teacher session:", error);
    }

    renderAuthState();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();
      const canManageParticipants = Boolean(authState.token && authState.username);

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canManageParticipants
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!authState.token) {
      showMessage("Teacher login required for this action.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Teacher-Token": authState.token,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!authState.token) {
      showMessage("Teacher login required for this action.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Teacher-Token": authState.token,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuToggle.addEventListener("click", () => {
    userMenuPanel.classList.toggle("hidden");
  });

  loginButton.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
    userMenuPanel.classList.add("hidden");
  });

  cancelLoginButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          "X-Teacher-Token": authState.token,
        },
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    authState.token = "";
    authState.username = "";
    localStorage.removeItem("teacherToken");
    renderAuthState();
    fetchActivities();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authState.token = result.token;
      authState.username = result.username;
      localStorage.setItem("teacherToken", authState.token);
      renderAuthState();
      fetchActivities();
      loginModal.classList.add("hidden");
      loginForm.reset();
      showMessage(`Logged in as ${result.username}`, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error during login:", error);
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    const insideMenu = userMenuPanel.contains(target) || userMenuToggle.contains(target);

    if (!insideMenu) {
      userMenuPanel.classList.add("hidden");
    }

    if (target === loginModal) {
      loginModal.classList.add("hidden");
      loginForm.reset();
    }
  });

  // Initialize app
  syncSession().then(fetchActivities);
});
