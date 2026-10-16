/* Sitio estático: funciona al abrir index.html, sin instalar dependencias. */
(() => {
  "use strict";

  const data = window.ROMELIA;
  const products = new Map(data.productos.map(product => [product.id, product]));
  const $ = id => document.getElementById(id);
  const money = amount => new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0
  }).format(amount);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const whatsappUrl = message => `https://wa.me/${data.whatsapp}?text=${encodeURIComponent(message)}`;
  const storageKey = "romelia-seleccion-v1";
  const maxQuantity = 20;
  const itemKey = item => `${item.id}|${item.variant}|${item.polaroid ? 1 : 0}`;

  // Solo se guardan identificadores y cantidades; los precios siempre se
  // recuperan del catálogo actual. La página también funciona sin almacenamiento.
  function cleanCart(value) {
    if (!Array.isArray(value)) return [];
    const cleaned = new Map();
    value.slice(0, 60).forEach(item => {
      if (!item || typeof item !== "object") return;
      const product = products.get(item.id);
      if (!product || product.tipo !== "producto") return;
      if (!Number.isInteger(item.variant) || !product.variantes[item.variant]) return;
      if (!Number.isInteger(item.quantity) || item.quantity < 1) return;
      const safeItem = {
        id: product.id,
        variant: item.variant,
        polaroid: product.polaroid === true && item.polaroid === true,
        quantity: Math.min(maxQuantity, item.quantity)
      };
      const key = itemKey(safeItem);
      if (cleaned.has(key)) {
        const existing = cleaned.get(key);
        existing.quantity = Math.min(maxQuantity, existing.quantity + safeItem.quantity);
      } else cleaned.set(key, safeItem);
    });
    return [...cleaned.values()];
  }

  function loadCart() {
    try { return cleanCart(JSON.parse(localStorage.getItem(storageKey) || "[]")); }
    catch { return []; }
  }

  let cart = loadCart();
  let selectedProduct = null;
  let detailQuantity = 1;
  let toastTimer;

  function unitPrice(item) {
    const product = products.get(item.id);
    return product.variantes[item.variant].precio + (item.polaroid ? data.polaroid : 0);
  }

  function cartMessage() {
    const lines = ["Hola, Romelia Atelier. Me gustaría consultar disponibilidad para esta selección:", ""];
    cart.forEach(item => {
      const product = products.get(item.id);
      const variant = product.variantes[item.variant];
      const extra = item.polaroid ? " + polaroid por pieza" : "";
      lines.push(`• ${item.quantity} × ${product.nombre}, ${variant.nombre}${extra}: ${money(unitPrice(item) * item.quantity)} MXN`);
    });
    const subtotal = cart.reduce((total, item) => total + unitPrice(item) * item.quantity, 0);
    lines.push("", `Subtotal de la selección: ${money(subtotal)} MXN.`, "Envío por cotizar.", "", "¿Podemos confirmar fecha, disponibilidad, cobertura y total? Entiendo que el pedido se confirma con el pago total.");
    return lines.join("\n");
  }

  function storeCart() {
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); }
    catch { /* La selección sigue funcionando en memoria. */ }
    renderCart();
  }

  function syncBodyScroll() {
    const openDialog = document.querySelector("dialog[open]");
    document.body.classList.toggle("modal-open", Boolean(openDialog));
    if (!openDialog && $("toast").parentElement !== document.body) document.body.append($("toast"));
  }

  function showDialog(dialog) {
    document.querySelectorAll("dialog[open]").forEach(other => {
      if (other !== dialog) other.close();
    });
    if (!dialog.open) dialog.showModal();
    syncBodyScroll();
  }

  function notify(message) {
    const toast = $("toast");
    const host = document.querySelector("dialog[open]") || document.body;
    if (toast.parentElement !== host) host.append(toast);
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
  }

  function productPriceLabel(product) {
    if (product.tipo === "suscripcion") return `${money(product.precio)} <small>MXN / mes</small>`;
    if (product.tipo === "cotizacion") return `Desde ${money(product.desde)} <small>MXN</small>`;
    return `Desde ${money(product.variantes[0].precio)} <small>MXN</small>`;
  }

  function renderCollection(category = "todos") {
    const visible = data.productos.filter(product => category === "todos" || product.categoria === category);
    $("product-grid").innerHTML = visible.map(product => `
      <article class="product-card" data-product-id="${product.id}">
        <button class="product-photo" type="button" data-product="${product.id}" aria-label="Ver ${escapeHtml(product.nombre)}" aria-haspopup="dialog">
          <img src="${product.imagen}" alt="${escapeHtml(product.alt)}" width="864" height="1184" loading="lazy">
          ${product.tipo === "suscripcion" ? '<span class="product-photo-label">CADA JUEVES</span>' : ""}
          <span class="quick-view" aria-hidden="true">${icon("plus")}</span>
        </button>
        <div class="product-info"><span class="product-category">${escapeHtml(product.etiqueta)}</span>
          <h3><button type="button" data-product="${product.id}" aria-haspopup="dialog">${escapeHtml(product.nombre)}</button></h3>
          <div class="product-bottom"><span class="product-price">${productPriceLabel(product)}</span>
            <button class="product-action" type="button" data-product="${product.id}" aria-label="${product.tipo === "producto" ? "Elegir" : "Consultar"} ${escapeHtml(product.nombre)}">${product.tipo === "producto" ? "Elegir diseño" : "Descubrir"} ${icon("up-right")}</button>
          </div>
        </div>
      </article>`).join("");
    $("collection-count").textContent = `${visible.length} ${visible.length === 1 ? "diseño" : "diseños"}`;
  }

  function detailMessage() {
    const product = selectedProduct;
    if (product.tipo === "suscripcion") {
      return `Hola, Romelia. Me interesa la suscripción mensual de ${money(product.precio)} MXN con 4 bouquets y entregas los jueves. ¿Me ayudan a confirmar cobertura y cómo contratarla?`;
    }
    if (product.tipo === "cotizacion") {
      return `Hola, Romelia. Me gustaría cotizar un diseño de autor en jarrón. Vi que los diseños parten de ${money(product.desde)} MXN. ¿Me ayudan con una propuesta y su disponibilidad?`;
    }
    const variantIndex = Number($("detail-size").value);
    const item = { id: product.id, variant: variantIndex, polaroid: $("detail-polaroid").checked && product.polaroid, quantity: detailQuantity };
    return `Hola, Romelia. Me gustaría consultar ${detailQuantity} × ${product.nombre}, tamaño ${product.variantes[variantIndex].nombre}${item.polaroid ? " con polaroid por pieza" : ""}. Subtotal: ${money(unitPrice(item) * detailQuantity)} MXN, más envío por cotizar. ¿Me ayudan a confirmar disponibilidad, fecha y entrega?`;
  }

  function updateDetail() {
    const product = selectedProduct;
    if (!product) return;
    if (product.tipo === "producto") {
      const item = { id: product.id, variant: Number($("detail-size").value), polaroid: $("detail-polaroid").checked && product.polaroid };
      $("detail-price").innerHTML = `${money(unitPrice(item) * detailQuantity)} <small>MXN${detailQuantity > 1 ? " · total de la selección" : ""}</small>`;
      $("detail-quantity").textContent = String(detailQuantity);
      $("quantity-minus").disabled = detailQuantity <= 1;
      $("quantity-plus").disabled = detailQuantity >= maxQuantity;
    } else $("detail-price").innerHTML = productPriceLabel(product);
    $("detail-consult").href = whatsappUrl(detailMessage());
  }

  function openProduct(id) {
    const product = products.get(id);
    if (!product) return;
    selectedProduct = product;
    detailQuantity = 1;
    $("product-title").textContent = product.nombre;
    $("detail-category").textContent = product.etiqueta.toUpperCase();
    $("detail-image").src = product.imagen;
    $("detail-image").alt = product.alt;
    $("detail-description").textContent = product.descripcion;
    $("detail-note").textContent = product.detalle;
    $("detail-polaroid").checked = false;
    const canAdd = product.tipo === "producto";
    $("purchase-options").hidden = !canAdd;
    $("detail-size").innerHTML = canAdd ? product.variantes.map((variant, index) => `<option value="${index}">${escapeHtml(variant.nombre)} — ${money(variant.precio)} MXN</option>`).join("") : "";
    $("polaroid-label").hidden = !product.polaroid;
    $("detail-submit").innerHTML = canAdd
      ? `Agregar a mi selección ${icon("plus")}`
      : `${product.tipo === "suscripcion" ? "Consultar cobertura y contratar" : "Cotizar mi diseño"} ${icon("up-right")}`;
    const images = product.imagenes || [];
    $("detail-thumbs").innerHTML = images.length > 1 ? images.map((src, index) => `<button type="button" data-detail-image="${index}" aria-label="Ver fotografía ${index + 1} de ${escapeHtml(product.nombre)}" aria-pressed="${index === 0}"><img src="${src}" alt=""></button>`).join("") : "";
    updateDetail();
    $("product-dialog").scrollTop = 0;
    showDialog($("product-dialog"));
  }

  function renderCart(focusToken) {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    $("cart-count").textContent = String(count);
    $("open-cart").setAttribute("aria-label", `Abrir mi selección, ${count} ${count === 1 ? "diseño" : "diseños"}`);
    $("cart-summary").hidden = cart.length === 0;
    if (cart.length === 0) {
      $("cart-content").innerHTML = `<div class="cart-empty">${icon("flower")}<h3>Todo empieza con una flor.</h3><p>Todavía no has elegido un diseño.<br>Encuentra ese detalle que te hace sentir algo.</p><a class="button button-dark" href="#coleccion" data-close="cart-dialog">Explorar la colección ${icon("arrow")}</a></div>`;
      $("cart-checkout").removeAttribute("href");
      return;
    }
    $("cart-content").innerHTML = cart.map(item => {
      const product = products.get(item.id);
      const variant = product.variantes[item.variant];
      const key = itemKey(item);
      return `<article class="cart-item"><img src="${product.imagen}" alt="${escapeHtml(product.alt)}" width="78" height="108"><div><h3>${escapeHtml(product.nombre)}</h3><p class="cart-item-details">${escapeHtml(variant.nombre)}${item.polaroid ? " · con polaroid por pieza (+ $49)" : ""}</p><p class="cart-item-price">${money(unitPrice(item) * item.quantity)} MXN</p><div class="cart-item-bottom"><div class="quantity-control"><button type="button" data-cart-action="minus" data-key="${key}" data-cart-focus="${key}:minus" aria-label="Reducir cantidad de ${escapeHtml(product.nombre)}, ${escapeHtml(variant.nombre)}" ${item.quantity === 1 ? "disabled" : ""}>${icon("minus")}</button><output aria-label="Cantidad de ${escapeHtml(product.nombre)}">${item.quantity}</output><button type="button" data-cart-action="plus" data-key="${key}" data-cart-focus="${key}:plus" aria-label="Aumentar cantidad de ${escapeHtml(product.nombre)}, ${escapeHtml(variant.nombre)}" ${item.quantity === maxQuantity ? "disabled" : ""}>${icon("plus")}</button></div><button class="remove-item" type="button" data-cart-action="remove" data-key="${key}" aria-label="Quitar ${escapeHtml(product.nombre)}, ${escapeHtml(variant.nombre)}">Quitar</button></div></div></article>`;
    }).join("");
    const subtotal = cart.reduce((total, item) => total + unitPrice(item) * item.quantity, 0);
    $("cart-total").textContent = `${money(subtotal)} MXN`;
    $("cart-checkout").href = whatsappUrl(cartMessage());
    if (focusToken) {
      const target = [...$("cart-content").querySelectorAll("[data-cart-focus]")].find(button => button.dataset.cartFocus === focusToken);
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else $("cart-dialog").querySelector("[data-close]").focus({ preventScroll: true });
    }
  }

  $("product-form").addEventListener("submit", event => {
    event.preventDefault();
    const product = selectedProduct;
    if (!product) return;
    if (product.tipo !== "producto") {
      window.open(whatsappUrl(detailMessage()), "_blank", "noopener,noreferrer");
      return;
    }
    const item = { id: product.id, variant: Number($("detail-size").value), polaroid: Boolean($("detail-polaroid").checked && product.polaroid), quantity: detailQuantity };
    const existing = cart.find(row => itemKey(row) === itemKey(item));
    if (existing) {
      const next = Math.min(maxQuantity, existing.quantity + item.quantity);
      if (existing.quantity === next) { notify("Máximo 20 piezas por combinación. Para cantidades mayores, escríbenos."); return; }
      const clipped = existing.quantity + item.quantity > maxQuantity;
      existing.quantity = next;
      if (clipped) notify("Esta combinación se ajustó al máximo de 20 piezas.");
    } else cart.push(item);
    storeCart();
    showDialog($("cart-dialog"));
  });

  $("detail-size").addEventListener("change", updateDetail);
  $("detail-polaroid").addEventListener("change", updateDetail);
  $("quantity-minus").addEventListener("click", () => { detailQuantity = Math.max(1, detailQuantity - 1); updateDetail(); });
  $("quantity-plus").addEventListener("click", () => { detailQuantity = Math.min(maxQuantity, detailQuantity + 1); updateDetail(); });
  $("open-cart").addEventListener("click", () => { renderCart(); showDialog($("cart-dialog")); });

  $("cart-content").addEventListener("click", event => {
    const button = event.target.closest("[data-cart-action]");
    if (!button || button.disabled) return;
    const index = cart.findIndex(item => itemKey(item) === button.dataset.key);
    if (index === -1) return;
    if (button.dataset.cartAction === "remove") cart.splice(index, 1);
    else cart[index].quantity = Math.max(1, Math.min(maxQuantity, cart[index].quantity + (button.dataset.cartAction === "plus" ? 1 : -1)));
    try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { /* Solo memoria. */ }
    renderCart(button.dataset.cartFocus || "removed");
    if (!cart.length) $("cart-dialog").querySelector("[data-close]").focus({ preventScroll: true });
  });

  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    renderCollection(button.dataset.filter);
    window.RomeliaPrivacy?.rememberCategory(button.dataset.filter);
  }));

  $("detail-thumbs").addEventListener("click", event => {
    const button = event.target.closest("[data-detail-image]");
    if (!button || !selectedProduct) return;
    const index = Number(button.dataset.detailImage);
    const src = selectedProduct.imagenes?.[index];
    if (!src) return;
    $("detail-image").src = src;
    $("detail-image").alt = `${selectedProduct.nombre}: fotografía de referencia ${index + 1}`;
    $("detail-thumbs").querySelectorAll("button").forEach(thumb => thumb.setAttribute("aria-pressed", String(thumb === button)));
  });

  function openPhoto(index) {
    const photo = data.inspiracion[index];
    if (!photo) return;
    $("lightbox-image").src = photo.imagen;
    $("lightbox-image").alt = photo.alt;
    $("lightbox-caption").textContent = photo.titulo;
    showDialog($("lightbox"));
  }

  $("inspiration-track").innerHTML = data.inspiracion.map((photo, index) => `<article class="inspiration-tile"><button class="inspiration-image" type="button" data-inspiration="${index}" aria-label="Ver fotografía: ${escapeHtml(photo.titulo)}" aria-haspopup="dialog"><img src="${photo.imagen}" alt="${escapeHtml(photo.alt)}" loading="lazy" width="400" height="500"></button><p>${escapeHtml(photo.titulo)}</p></article>`).join("");
  const track = $("inspiration-track");
  function updateGalleryArrows() {
    $("gallery-prev").disabled = track.scrollLeft < 2;
    $("gallery-next").disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  function scrollGallery(direction) {
    const tile = track.querySelector(".inspiration-tile");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 18;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * ((tile?.getBoundingClientRect().width || 250) + gap), behavior: reducedMotion ? "auto" : "smooth" });
  }
  $("gallery-prev").addEventListener("click", () => scrollGallery(-1));
  $("gallery-next").addEventListener("click", () => scrollGallery(1));
  track.addEventListener("scroll", updateGalleryArrows, { passive: true });
  window.addEventListener("resize", updateGalleryArrows);
  window.addEventListener("load", updateGalleryArrows);
  requestAnimationFrame(updateGalleryArrows);

  function closeMenu() {
    $("mobile-menu").hidden = true;
    $("menu-toggle").setAttribute("aria-expanded", "false");
    $("menu-toggle").setAttribute("aria-label", "Abrir menú");
    $("menu-toggle").innerHTML = icon("menu");
  }
  $("menu-toggle").addEventListener("click", () => {
    const open = $("menu-toggle").getAttribute("aria-expanded") !== "true";
    $("mobile-menu").hidden = !open;
    $("menu-toggle").setAttribute("aria-expanded", String(open));
    $("menu-toggle").setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    $("menu-toggle").innerHTML = icon(open ? "close" : "menu");
  });
  $("mobile-menu").addEventListener("click", event => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeMenu(); });
  window.addEventListener("resize", () => { if (window.innerWidth > 800) closeMenu(); });

  document.addEventListener("click", event => {
    const productButton = event.target.closest("[data-product]");
    if (productButton) openProduct(productButton.dataset.product);
    const photoButton = event.target.closest("[data-inspiration]");
    if (photoButton) openPhoto(Number(photoButton.dataset.inspiration));
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) $(closeButton.dataset.close)?.close();
    if (!event.target.closest(".site-header")) closeMenu();
  });

  document.querySelectorAll("dialog").forEach(dialog => {
    dialog.addEventListener("close", syncBodyScroll);
    // El fondo se cierra solo cuando tanto el inicio como el final del clic
    // ocurren fuera del rectángulo: seleccionar texto no cierra la ventana.
    let pointerStartedOutside = false;
    const isOutside = event => {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    dialog.addEventListener("pointerdown", event => { pointerStartedOutside = event.target === dialog && isOutside(event); });
    dialog.addEventListener("click", event => {
      if (event.target === dialog && pointerStartedOutside && isOutside(event)) dialog.close();
      pointerStartedOutside = false;
    });
  });

  window.addEventListener("storage", event => {
    if (event.key === storageKey) { cart = loadCart(); renderCart(); }
  });

  window.addEventListener("romelia:privacy-saved", event => {
    notify(event.detail.persisted ? "Tus preferencias de cookies quedaron guardadas." : "Tu elección se aplicó a esta visita. El navegador impide guardarla para la próxima.");
  });

  $("year").textContent = String(new Date().getFullYear());
  const savedCategory = window.RomeliaPrivacy?.getCategory() || "todos";
  document.querySelectorAll("[data-filter]").forEach(button => {
    const active = button.dataset.filter === savedCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderCollection(savedCategory);
  renderCart();
})();
