/* BorrowBox frontend logic - plain JS, no frameworks. */

// Change this if your backend runs somewhere else.
const API_BASE = window.BorrowBox_API_BASE || "https://borrowbox-backend-lgf9.onrender.com";

const CATEGORY_EMOJI = {
  Property: "🏠", Furniture: "🛋️", Electronics: "🔌", Vehicles: "🚗",
  Gaming: "🎮", Cameras: "📷", Appliances: "🧺", Tools: "🛠️",
  Sports: "🏸", Study: "📚", Other: "📦",
};

// ---------------------------------------------------------------
// Auth / storage helpers
// ---------------------------------------------------------------

function getToken() {
  return localStorage.getItem("BorrowBox_token");
}

function getStoredUser() {
  const raw = localStorage.getItem("BorrowBox_user");
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem("BorrowBox_token", token);
  localStorage.setItem("BorrowBox_user", JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem("BorrowBox_token");
  localStorage.removeItem("BorrowBox_user");
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}

// ---------------------------------------------------------------
// API helper
// ---------------------------------------------------------------

async function apiRequest(path, { method = "GET", body = null, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) options.body = isForm ? body : JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch (err) {
    throw new Error("Could not reach the server. Is the backend running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // no JSON body
  }

  if (!res.ok) {
    const message = (data && data.detail) ? data.detail : `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

// ---------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------

function formatPrice(value) {
  if (value === null || value === undefined) return "-";
  return "₹" + Number(value).toLocaleString("en-IN");
}

function firstImage(product) {
  if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
  return "https://placehold.co/400x300?text=No+Image";
}

function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function showMessage(node, message, isError = true) {
  if (!node) return;
  node.textContent = message;
  node.style.display = "block";
  node.className = isError ? "error-msg" : "success-msg";
  node.style.display = "block";
}

function hideMessage(node) {
  if (!node) return;
  node.style.display = "none";
}

// ---------------------------------------------------------------
// Navbar (rendered on every page)
// ---------------------------------------------------------------

function renderNavbar() {
  const mount = document.getElementById("navbar-mount");
  if (!mount) return;

  const user = getStoredUser();

  let rightSide;
  if (user) {
    const dashboardLink = user.role === "seller" ? "seller.html" : "customer.html";
    rightSide = `
      <span id="nav-user-badge">${user.role === "seller" ? "🏪" : "🙂"} ${escapeHtml(user.name)}</span>
      <a href="${dashboardLink}">Dashboard</a>
      <a href="#" id="nav-logout-link" class="btn btn-outline btn-small">Logout</a>
    `;
  } else {
    rightSide = `
      <a href="login.html">Login</a>
      <a href="register.html" class="btn btn-primary btn-small">Register</a>
    `;
  }

  mount.innerHTML = `
    <div class="container">
      <a href="index.html" class="logo">Borrow<span>Box</span></a>
      <div class="nav-links">
        <a href="index.html">Home</a>
        <a href="products.html">Browse</a>
        ${user && user.role === "seller" ? '<a href="seller.html">Sell</a>' : '<a href="register.html">Sell</a>'}
        ${rightSide}
      </div>
    </div>
  `;

  const logoutLink = document.getElementById("nav-logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------------------------------------------------------
// Product card builder (shared by index + products pages)
// ---------------------------------------------------------------

function productCard(product) {
  const badges = [];
  if (product.available_for_sale) badges.push(`<span class="badge badge-buy">Buy ${formatPrice(product.buy_price)}</span>`);
  if (product.available_for_rent) badges.push(`<span class="badge badge-rent">Rent ${formatPrice(product.rent_price)}/${product.rent_period}</span>`);

  return el(`
    <a class="product-card" href="product.html?id=${product.id}" style="cursor:pointer;">
      <img class="thumb" src="${firstImage(product)}" alt="${escapeHtml(product.title)}" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
      <div class="body">
        <h3>${escapeHtml(product.title)}</h3>
        <div class="meta">📍 ${escapeHtml(product.location)} · ${escapeHtml(product.category)}</div>
        <div class="price-row">${badges.join("")}</div>
      </div>
    </a>
  `);
}

// ---------------------------------------------------------------
// Page: index.html
// ---------------------------------------------------------------

async function initHomePage() {
  const categoryGrid = document.getElementById("category-grid");
  const featuredGrid = document.getElementById("featured-grid");
  const searchForm = document.getElementById("hero-search-form");

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("hero-search-input").value.trim();
      window.location.href = q ? `products.html?search=${encodeURIComponent(q)}` : "products.html";
    });
  }

  try {
    const { categories } = await apiRequest("/api/categories");
    if (categoryGrid) {
      categoryGrid.innerHTML = "";
      categories.forEach((cat) => {
        const card = el(`
          <a class="category-card" href="products.html?category=${encodeURIComponent(cat)}">
            <span class="cat-emoji">${CATEGORY_EMOJI[cat] || "📦"}</span>${escapeHtml(cat)}
          </a>
        `);
        categoryGrid.appendChild(card);
      });
    }
  } catch (err) {
    if (categoryGrid) categoryGrid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }

  try {
    const { products } = await apiRequest("/api/products?limit=8");
    if (featuredGrid) {
      featuredGrid.innerHTML = "";
      if (products.length === 0) {
        featuredGrid.innerHTML = `<div class="empty-state">No listings yet. Be the first to sell something!</div>`;
      }
      products.forEach((p) => featuredGrid.appendChild(productCard(p)));
    }
  } catch (err) {
    if (featuredGrid) featuredGrid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------
// Page: products.html
// ---------------------------------------------------------------

async function initProductsPage() {
  const grid = document.getElementById("products-grid");
  const searchInput = document.getElementById("filter-search");
  const categorySelect = document.getElementById("filter-category");
  const locationInput = document.getElementById("filter-location");
  const typeSelect = document.getElementById("filter-type");
  const form = document.getElementById("filters-form");

  const params = new URLSearchParams(window.location.search);
  if (searchInput) searchInput.value = params.get("search") || "";
  if (locationInput) locationInput.value = params.get("location") || "";

  try {
    const { categories } = await apiRequest("/api/categories");
    if (categorySelect) {
      categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        if (params.get("category") === cat) opt.selected = true;
        categorySelect.appendChild(opt);
      });
    }
  } catch (_) { /* categories are non-critical here */ }

  async function loadProducts() {
    grid.innerHTML = `<div class="empty-state">Loading listings...</div>`;
    const query = new URLSearchParams();
    if (searchInput && searchInput.value.trim()) query.set("search", searchInput.value.trim());
    if (categorySelect && categorySelect.value) query.set("category", categorySelect.value);
    if (locationInput && locationInput.value.trim()) query.set("location", locationInput.value.trim());
    if (typeSelect && typeSelect.value === "buy") query.set("available_for_sale", "true");
    if (typeSelect && typeSelect.value === "rent") query.set("available_for_rent", "true");

    try {
      const { products } = await apiRequest(`/api/products?${query.toString()}`);
      grid.innerHTML = "";
      if (products.length === 0) {
        grid.innerHTML = `<div class="empty-state">No listings match your filters.</div>`;
        return;
      }
      products.forEach((p) => grid.appendChild(productCard(p)));
    } catch (err) {
      grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    }
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      loadProducts();
    });
  }

  loadProducts();
}

// ---------------------------------------------------------------
// Page: product.html
// ---------------------------------------------------------------

async function initProductDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  const container = document.getElementById("product-detail-container");
  const actionMsg = document.getElementById("action-msg");

  if (!productId) {
    container.innerHTML = `<div class="empty-state">No product specified.</div>`;
    return;
  }

  let product;
  try {
    product = await apiRequest(`/api/products/${productId}`);
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
    return;
  }

  document.title = `${product.title} - BorrowBox`;

  const user = getStoredUser();
  const isOwner = user && user.role === "seller" && user.id === product.seller_id;

  const rentDateFields = product.available_for_rent
    ? `
      <div class="form-row mt-16">
        <div class="form-group">
          <label>Start date</label>
          <input type="date" id="rent-start-date">
        </div>
        <div class="form-group">
          <label>End date</label>
          <input type="date" id="rent-end-date">
        </div>
      </div>
    `
    : "";

  container.innerHTML = "";
  container.appendChild(el(`
    <div class="product-detail">
      <div>
        <img class="main-image" src="${firstImage(product)}" alt="${escapeHtml(product.title)}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">
      </div>
      <div>
        <h1>${escapeHtml(product.title)}</h1>
        <div class="meta">📍 ${escapeHtml(product.location)} · ${escapeHtml(product.category)}</div>
        <p class="mt-16">${escapeHtml(product.description)}</p>

        <div class="price-box">
          ${product.available_for_sale ? `<div class="price-line"><span>Buy price</span><strong>${formatPrice(product.buy_price)}</strong></div>` : ""}
          ${product.available_for_rent ? `<div class="price-line"><span>Rent price</span><strong>${formatPrice(product.rent_price)} / ${escapeHtml(product.rent_period)}</strong></div>` : ""}
          ${rentDateFields}
          <div id="action-msg" class="error-msg mt-16"></div>
          <div class="mt-16" style="display:flex; gap:10px; flex-wrap:wrap;">
            ${!isOwner && product.available_for_sale ? `<button id="buy-btn" class="btn btn-primary">Buy Now</button>` : ""}
            ${!isOwner && product.available_for_rent ? `<button id="rent-btn" class="btn btn-accent">Rent Now</button>` : ""}
            ${isOwner ? `<a href="seller.html" class="btn btn-outline">Manage this listing in your dashboard</a>` : ""}
          </div>
        </div>

        ${product.seller ? `
          <div class="seller-box">
            <strong>Seller:</strong> ${escapeHtml(product.seller.name)}<br>
            ${product.seller.phone ? `<strong>Phone:</strong> ${escapeHtml(product.seller.phone)}` : ""}
          </div>
        ` : ""}
      </div>
    </div>
  `));

  const msgNode = document.getElementById("action-msg");

  const buyBtn = document.getElementById("buy-btn");
  if (buyBtn) {
    buyBtn.addEventListener("click", async () => {
      if (!requireLoginRedirect("customer")) return;
      buyBtn.disabled = true;
      try {
        await apiRequest("/api/transactions/buy", { method: "POST", auth: true, body: { product_id: productId } });
        showMessage(msgNode, "Purchase request placed! Check your dashboard for status.", false);
      } catch (err) {
        showMessage(msgNode, err.message, true);
      } finally {
        buyBtn.disabled = false;
      }
    });
  }

  const rentBtn = document.getElementById("rent-btn");
  if (rentBtn) {
    rentBtn.addEventListener("click", async () => {
      if (!requireLoginRedirect("customer")) return;
      const start = document.getElementById("rent-start-date").value;
      const end = document.getElementById("rent-end-date").value;
      if (!start || !end) {
        showMessage(msgNode, "Please choose both a start and end date.", true);
        return;
      }
      rentBtn.disabled = true;
      try {
        await apiRequest("/api/transactions/rent", {
          method: "POST",
          auth: true,
          body: { product_id: productId, start_date: start, end_date: end },
        });
        showMessage(msgNode, "Rental request placed! Check your dashboard for status.", false);
      } catch (err) {
        showMessage(msgNode, err.message, true);
      } finally {
        rentBtn.disabled = false;
      }
    });
  }
}

function requireLoginRedirect(requiredRole) {
  const user = getStoredUser();
  if (!user) {
    window.location.href = `login.html?next=${encodeURIComponent(window.location.href)}`;
    return false;
  }
  if (requiredRole && user.role !== requiredRole) {
    alert(`Only ${requiredRole}s can do this.`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------
// Page: login.html
// ---------------------------------------------------------------

function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorNode = document.getElementById("login-error");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage(errorNode);

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      const data = await apiRequest("/api/auth/login", { method: "POST", body: { email, password } });
      setSession(data.access_token, data.user);

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next) {
        window.location.href = next;
      } else if (data.user.role === "seller") {
        window.location.href = "seller.html";
      } else {
        window.location.href = "customer.html";
      }
    } catch (err) {
      showMessage(errorNode, err.message, true);
      submitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------
// Page: register.html
// ---------------------------------------------------------------

function initRegisterPage() {
  const form = document.getElementById("register-form");
  const errorNode = document.getElementById("register-error");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage(errorNode);

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const phone = document.getElementById("register-phone").value.trim();
    const password = document.getElementById("register-password").value;
    const role = document.querySelector('input[name="role"]:checked')?.value;
    const submitBtn = form.querySelector("button[type=submit]");

    if (!role) {
      showMessage(errorNode, "Please choose a role.", true);
      return;
    }

    submitBtn.disabled = true;
    try {
      await apiRequest("/api/auth/register", { method: "POST", body: { name, email, phone, password, role } });
      const loginData = await apiRequest("/api/auth/login", { method: "POST", body: { email, password } });
      setSession(loginData.access_token, loginData.user);
      window.location.href = role === "seller" ? "seller.html" : "customer.html";
    } catch (err) {
      showMessage(errorNode, err.message, true);
      submitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------
// Page: seller.html
// ---------------------------------------------------------------

async function initSellerPage() {
  if (!requireLoginRedirect("seller")) return;

  const user = getStoredUser();
  document.getElementById("seller-welcome").textContent = `Welcome back, ${user.name}!`;

  initTabs();
  loadSellerListings();
  loadSellerTransactions();
  await populateCategoryOptions("add-category");
  wireAddListingForm();
  wireAvailabilityToggles();
}

async function loadSellerListings() {
  const container = document.getElementById("seller-listings");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const { products } = await apiRequest("/api/seller/products", { auth: true });
    container.innerHTML = "";
    if (products.length === 0) {
      container.innerHTML = `<div class="empty-state">You haven't listed anything yet. Use "Add Listing" to get started.</div>`;
      return;
    }
    products.forEach((p) => container.appendChild(sellerListingCard(p)));
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function sellerListingCard(product) {
  const statusBadge = product.status === "active"
    ? `<span class="badge badge-buy">Active</span>`
    : `<span class="badge badge-status-cancelled">Inactive</span>`;

  const card = el(`
    <div class="list-card">
      <img src="${firstImage(product)}" onerror="this.src='https://placehold.co/100?text=No+Image'">
      <div class="info">
        <h4>${escapeHtml(product.title)}</h4>
        <div class="meta">
          ${product.available_for_sale ? `Buy: ${formatPrice(product.buy_price)} · ` : ""}
          ${product.available_for_rent ? `Rent: ${formatPrice(product.rent_price)}/${escapeHtml(product.rent_period)} · ` : ""}
          ${statusBadge}
        </div>
      </div>
      <div class="actions">
        <a href="product.html?id=${product.id}" class="btn btn-outline btn-small">View</a>
        ${product.status === "active" ? `<button class="btn btn-danger btn-small" data-deactivate="${product.id}">Deactivate</button>` : ""}
      </div>
    </div>
  `);

  const deactivateBtn = card.querySelector("[data-deactivate]");
  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", async () => {
      if (!confirm("Deactivate this listing?")) return;
      deactivateBtn.disabled = true;
      try {
        await apiRequest(`/api/products/${product.id}`, { method: "DELETE", auth: true });
        loadSellerListings();
      } catch (err) {
        alert(err.message);
        deactivateBtn.disabled = false;
      }
    });
  }

  return card;
}

async function loadSellerTransactions() {
  const container = document.getElementById("seller-transactions");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const { transactions } = await apiRequest("/api/seller/transactions", { auth: true });
    container.innerHTML = "";
    if (transactions.length === 0) {
      container.innerHTML = `<div class="empty-state">No buy or rent requests yet.</div>`;
      return;
    }
    transactions.forEach((t) => container.appendChild(sellerTransactionCard(t)));
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function sellerTransactionCard(txn) {
  const card = el(`
    <div class="list-card">
      <div class="info">
        <h4>${txn.type === "buy" ? "🛒 Purchase" : "📅 Rental"} · ${formatPrice(txn.amount)}</h4>
        <div class="meta">
          ${txn.start_date ? `${txn.start_date} → ${txn.end_date} · ` : ""}
          <span class="badge badge-status-${txn.status}">${txn.status}</span>
        </div>
      </div>
      <div class="actions" data-actions></div>
    </div>
  `);

  const actionsDiv = card.querySelector("[data-actions]");
  if (txn.status === "pending") {
    const approveBtn = el(`<button class="btn btn-primary btn-small">Approve</button>`);
    const cancelBtn = el(`<button class="btn btn-danger btn-small">Cancel</button>`);
    approveBtn.addEventListener("click", () => updateTxnStatus(txn.id, "approved"));
    cancelBtn.addEventListener("click", () => updateTxnStatus(txn.id, "cancelled"));
    actionsDiv.appendChild(approveBtn);
    actionsDiv.appendChild(cancelBtn);
  } else if (txn.status === "approved") {
    const completeBtn = el(`<button class="btn btn-primary btn-small">Mark Completed</button>`);
    completeBtn.addEventListener("click", () => updateTxnStatus(txn.id, "completed"));
    actionsDiv.appendChild(completeBtn);
  }

  return card;
}

async function updateTxnStatus(txnId, status) {
  try {
    await apiRequest(`/api/transactions/${txnId}/status`, { method: "PUT", auth: true, body: { status } });
    loadSellerTransactions();
  } catch (err) {
    alert(err.message);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

async function populateCategoryOptions(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const { categories } = await apiRequest("/api/categories");
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  } catch (_) { /* non-critical */ }
}

function wireAvailabilityToggles() {
  const saleCheckbox = document.getElementById("add-available-sale");
  const rentCheckbox = document.getElementById("add-available-rent");
  const saleFields = document.getElementById("sale-price-fields");
  const rentFields = document.getElementById("rent-price-fields");

  function sync() {
    saleFields.style.display = saleCheckbox.checked ? "block" : "none";
    rentFields.style.display = rentCheckbox.checked ? "block" : "none";
  }
  saleCheckbox.addEventListener("change", sync);
  rentCheckbox.addEventListener("change", sync);
  sync();
}

function wireAddListingForm() {
  const form = document.getElementById("add-listing-form");
  const errorNode = document.getElementById("add-listing-error");
  const successNode = document.getElementById("add-listing-success");
  const imageInput = document.getElementById("add-image");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage(errorNode);
    hideMessage(successNode);

    const submitBtn = form.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing...";

    try {
      if (!imageInput.files || imageInput.files.length === 0) {
        throw new Error("At least one image is required.");
      }

      // Upload each selected image to Cloudinary via the backend.
      const imageUrls = [];
      for (const file of imageInput.files) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await apiRequest("/api/upload", { method: "POST", auth: true, isForm: true, body: formData });
        imageUrls.push(uploadResult.url);
      }

      const availableForSale = document.getElementById("add-available-sale").checked;
      const availableForRent = document.getElementById("add-available-rent").checked;

      if (!availableForSale && !availableForRent) {
        throw new Error("Enable at least one of Sale or Rent.");
      }

      const payload = {
        title: document.getElementById("add-title").value.trim(),
        description: document.getElementById("add-description").value.trim(),
        category: document.getElementById("add-category").value,
        location: document.getElementById("add-location").value.trim(),
        image_urls: imageUrls,
        available_for_sale: availableForSale,
        available_for_rent: availableForRent,
        buy_price: availableForSale ? Number(document.getElementById("add-buy-price").value) : null,
        rent_price: availableForRent ? Number(document.getElementById("add-rent-price").value) : null,
        rent_period: availableForRent ? document.getElementById("add-rent-period").value : null,
      };

      await apiRequest("/api/products", { method: "POST", auth: true, body: payload });

      showMessage(successNode, "Listing published successfully!", false);
      form.reset();
      wireAvailabilityToggles();
      loadSellerListings();
    } catch (err) {
      showMessage(errorNode, err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish Listing";
    }
  });
}

// ---------------------------------------------------------------
// Page: customer.html
// ---------------------------------------------------------------

async function initCustomerPage() {
  if (!requireLoginRedirect("customer")) return;

  const user = getStoredUser();
  document.getElementById("customer-welcome").textContent = `Welcome back, ${user.name}!`;
  document.getElementById("customer-email").textContent = user.email;
  document.getElementById("customer-phone").textContent = user.phone || "-";

  const container = document.getElementById("customer-transactions");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;

  try {
    const { transactions } = await apiRequest("/api/transactions/my", { auth: true });
    container.innerHTML = "";
    if (transactions.length === 0) {
      container.innerHTML = `<div class="empty-state">You haven't bought or rented anything yet. <a href="products.html">Browse listings</a>.</div>`;
      return;
    }
    transactions.forEach((t) => {
      container.appendChild(el(`
        <div class="list-card">
          <div class="info">
            <h4>${t.type === "buy" ? "🛒 Purchase" : "📅 Rental"} · ${formatPrice(t.amount)}</h4>
            <div class="meta">
              ${t.start_date ? `${t.start_date} → ${t.end_date} · ` : ""}
              <span class="badge badge-status-${t.status}">${t.status}</span>
            </div>
          </div>
          <div class="actions">
            <a href="product.html?id=${t.product_id}" class="btn btn-outline btn-small">View item</a>
          </div>
        </div>
      `));
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------
// Dispatch on load
// ---------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  const page = document.body.dataset.page;
  const dispatch = {
    home: initHomePage,
    products: initProductsPage,
    product: initProductDetailPage,
    login: initLoginPage,
    register: initRegisterPage,
    seller: initSellerPage,
    customer: initCustomerPage,
  };

  if (page && dispatch[page]) dispatch[page]();
});
