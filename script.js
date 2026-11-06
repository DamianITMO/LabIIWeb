(function () {
  "use strict";

  // ---------- State ----------
  let tasks = [];
  let filterStatus = "all"; // all | active | completed
  let sortBy = "order"; // order | date-asc | date-desc
  let searchQuery = "";
  let dragSrcId = null;

  const STORAGE_KEY = "todo-list-tasks";

  // ---------- Helpers ----------
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function formatDate(iso) {
    if (!iso) return "Без даты";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tasks = parsed.map((t, i) => ({
            id: t.id || generateId(),
            title: t.title || "",
            date: t.date || "",
            completed: Boolean(t.completed),
            order: typeof t.order === "number" ? t.order : i,
          }));
        }
      }
    } catch (e) {
      console.warn("Не удалось загрузить задачи:", e);
      tasks = [];
    }
  }

  function getFilteredTasks() {
    let list = [...tasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }

    // Filter by status
    if (filterStatus === "active") {
      list = list.filter((t) => !t.completed);
    } else if (filterStatus === "completed") {
      list = list.filter((t) => t.completed);
    }

    // Sort
    if (sortBy === "date-asc") {
      list.sort((a, b) => {
        if (!a.date && !b.date) return a.order - b.order;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date) || a.order - b.order;
      });
    } else if (sortBy === "date-desc") {
      list.sort((a, b) => {
        if (!a.date && !b.date) return a.order - b.order;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date) || a.order - b.order;
      });
    } else {
      // custom order (drag-and-drop)
      list.sort((a, b) => a.order - b.order);
    }

    return list;
  }

  // ---------- DOM creation ----------
  function createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === "className") {
        el.className = value;
      } else if (key === "textContent") {
        el.textContent = value;
      } else if (key === "innerHTML") {
        el.innerHTML = value;
      } else if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "dataset") {
        Object.entries(value).forEach(([k, v]) => {
          el.dataset[k] = v;
        });
      } else if (value !== undefined && value !== null) {
        el.setAttribute(key, value);
      }
    });
    children.forEach((child) => {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    });
    return el;
  }

  // ---------- Build UI ----------
  function buildApp() {
    const app = createElement("div", { className: "app" });

    // Header
    const header = createElement("header", { className: "header" }, [
      createElement("h1", { textContent: "Задачник" }),
      createElement("p", {
        textContent: "Создавайте, редактируйте и организуйте свои задачи",
      }),
    ]);

    // Form
    const formCard = createElement("section", {
      className: "form-card",
      "aria-label": "Добавить задачу",
    });

    const form = createElement("form", { id: "task-form" });

    const row1 = createElement("div", { className: "form-row" });

    const titleGroup = createElement("div", { className: "input-group" }, [
      createElement("label", { for: "task-title", textContent: "Название задачи" }),
      createElement("input", {
        type: "text",
        id: "task-title",
        name: "title",
        placeholder: "Впишите название задачи",
        required: "required",
        autocomplete: "off",
        maxlength: "200",
      }),
    ]);

    const dateGroup = createElement("div", { className: "input-group" }, [
      createElement("label", { for: "task-date", textContent: "Дата" }),
      createElement("input", {
        type: "date",
        id: "task-date",
        name: "date",
      }),
    ]);

    row1.append(titleGroup, dateGroup);

    const row2 = createElement("div", { className: "form-row" });
    const submitBtn = createElement("button", {
      type: "submit",
      className: "btn btn-primary",
      textContent: "Добавить задачу",
    });
    row2.appendChild(submitBtn);

    form.append(row1, row2);
    formCard.appendChild(form);

    // Controls
    const controls = createElement("div", { className: "controls" });

    const searchBox = createElement("div", { className: "search-box" }, [
      createElement("input", {
        type: "search",
        id: "search-input",
        placeholder: "Поиск по названию…",
        "aria-label": "Поиск задач",
      }),
    ]);

    const selectGroup = createElement("div", { className: "select-group" });

    const filterSelect = createElement("select", {
      id: "filter-status",
      "aria-label": "Фильтр по статусу",
    });
    [
      { value: "all", text: "Все задачи" },
      { value: "active", text: "Активные" },
      { value: "completed", text: "Выполненные" },
    ].forEach((opt) => {
      filterSelect.appendChild(
        createElement("option", { value: opt.value, textContent: opt.text })
      );
    });

    const sortSelect = createElement("select", {
      id: "sort-by",
      "aria-label": "Сортировка",
    });
    [
      { value: "order", text: "По порядку" },
      { value: "date-asc", text: "Дата ↑" },
      { value: "date-desc", text: "Дата ↓" },
    ].forEach((opt) => {
      sortSelect.appendChild(
        createElement("option", { value: opt.value, textContent: opt.text })
      );
    });

    selectGroup.append(filterSelect, sortSelect);
    controls.append(searchBox, selectGroup);

    // Task list
    const taskList = createElement("ul", {
      className: "task-list",
      id: "task-list",
      "aria-label": "Список задач",
    });

    // Stats
    const stats = createElement("div", {
      className: "stats",
      id: "stats",
    });

    app.append(header, formCard, controls, taskList, stats);
    document.body.appendChild(app);

    // Event listeners
    form.addEventListener("submit", handleAddTask);
    document.getElementById("search-input").addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderTasks();
    });
    filterSelect.addEventListener("change", (e) => {
      filterStatus = e.target.value;
      renderTasks();
    });
    sortSelect.addEventListener("change", (e) => {
      sortBy = e.target.value;
      renderTasks();
    });
  }

  // ---------- Task item ----------
  function createTaskItem(task) {
    const li = createElement("li", {
      className: "task-item" + (task.completed ? " completed" : ""),
      dataset: { id: task.id },
      draggable: "true",
    });

    // Drag events
    li.addEventListener("dragstart", handleDragStart);
    li.addEventListener("dragend", handleDragEnd);
    li.addEventListener("dragover", handleDragOver);
    li.addEventListener("dragenter", handleDragEnter);
    li.addEventListener("dragleave", handleDragLeave);
    li.addEventListener("drop", handleDrop);

    const checkbox = createElement("input", {
      type: "checkbox",
      className: "task-checkbox",
      checked: task.completed ? "checked" : undefined,
      "aria-label": "Отметить как выполненную",
    });
    checkbox.addEventListener("change", () => toggleComplete(task.id));

    const content = createElement("div", { className: "task-content" }, [
      createElement("div", {
        className: "task-title",
        textContent: task.title,
      }),
      createElement("div", {
        className: "task-date",
        textContent: formatDate(task.date),
      }),
    ]);

    const actions = createElement("div", { className: "task-actions" });

    const editBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "",
      title: "Редактировать",
      "aria-label": "Редактировать задачу",
    });
    editBtn.addEventListener("click", () => startEdit(task.id, li));

    const deleteBtn = createElement("button", {
      type: "button",
      className: "btn btn-danger",
      textContent: "",
      title: "Удалить",
      "aria-label": "Удалить задачу",
    });
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(editBtn, deleteBtn);
    li.append(checkbox, content, actions);

    return li;
  }

  function startEdit(id, li) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    li.innerHTML = "";
    li.classList.remove("completed");
    li.draggable = false;

    const form = createElement("form", { className: "edit-form" });

    const titleInput = createElement("input", {
      type: "text",
      value: task.title,
      required: "required",
      maxlength: "200",
      "aria-label": "Новое название",
    });

    const dateInput = createElement("input", {
      type: "date",
      value: task.date || "",
      "aria-label": "Новая дата",
    });

    const actions = createElement("div", { className: "edit-actions" });

    const saveBtn = createElement("button", {
      type: "submit",
      className: "btn btn-primary",
      textContent: "Сохранить",
    });

    const cancelBtn = createElement("button", {
      type: "button",
      className: "btn btn-secondary",
      textContent: "Отмена",
    });
    cancelBtn.addEventListener("click", () => renderTasks());

    actions.append(saveBtn, cancelBtn);
    form.append(titleInput, dateInput, actions);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const newTitle = titleInput.value.trim();
      if (!newTitle) return;
      task.title = newTitle;
      task.date = dateInput.value || "";
      saveTasks();
      renderTasks();
    });

    li.appendChild(form);
    titleInput.focus();
  }

  // ---------- CRUD ----------
  function handleAddTask(e) {
    e.preventDefault();
    const form = e.target;
    const titleInput = form.querySelector("#task-title");
    const dateInput = form.querySelector("#task-date");

    const title = titleInput.value.trim();
    if (!title) return;

    const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);

    const newTask = {
      id: generateId(),
      title,
      date: dateInput.value || "",
      completed: false,
      order: maxOrder + 1,
    };

    tasks.push(newTask);
    saveTasks();
    form.reset();
    titleInput.focus();
    renderTasks();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    // Normalize order
    tasks
      .sort((a, b) => a.order - b.order)
      .forEach((t, i) => {
        t.order = i;
      });
    saveTasks();
    renderTasks();
  }

  function toggleComplete(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      renderTasks();
    }
  }

  // ---------- Drag & Drop ----------
  function handleDragStart(e) {
    dragSrcId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragSrcId);
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove("dragging");
    document.querySelectorAll(".task-item").forEach((el) => {
      el.classList.remove("drag-over");
    });
    dragSrcId = null;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDragEnter(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (target.dataset.id !== dragSrcId) {
      target.classList.add("drag-over");
    }
  }

  function handleDragLeave(e) {
    e.currentTarget.classList.remove("drag-over");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    const targetId = e.currentTarget.dataset.id;
    if (!dragSrcId || dragSrcId === targetId) return;

    // Only allow reorder when sorting by custom order
    if (sortBy !== "order") {
      // Temporarily switch to order mode so user sees the new order
      sortBy = "order";
      document.getElementById("sort-by").value = "order";
    }

    const srcIndex = tasks.findIndex((t) => t.id === dragSrcId);
    const targetIndex = tasks.findIndex((t) => t.id === targetId);
    if (srcIndex === -1 || targetIndex === -1) return;

    // Reorder by order values
    const sorted = [...tasks].sort((a, b) => a.order - b.order);
    const srcPos = sorted.findIndex((t) => t.id === dragSrcId);
    const targetPos = sorted.findIndex((t) => t.id === targetId);

    const [moved] = sorted.splice(srcPos, 1);
    sorted.splice(targetPos, 0, moved);

    sorted.forEach((t, i) => {
      t.order = i;
    });

    saveTasks();
    renderTasks();
  }

  // ---------- Render ----------
  function renderTasks() {
    const listEl = document.getElementById("task-list");
    const statsEl = document.getElementById("stats");
    if (!listEl) return;

    listEl.innerHTML = "";

    const filtered = getFilteredTasks();

    if (filtered.length === 0) {
      const empty = createElement("div", { className: "empty-state" }, [
        createElement("p", {
          textContent:
            tasks.length === 0
              ? "Пока нет задач. Добавьте первую!"
              : "Ничего не найдено по текущим фильтрам.",
        }),
      ]);
      listEl.appendChild(empty);
    } else {
      filtered.forEach((task) => {
        listEl.appendChild(createTaskItem(task));
      });
    }

    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const active = total - completed;
    statsEl.textContent = `Всего: ${total} · Активных: ${active} · Выполнено: ${completed}`;
  }

  // ---------- Init ----------
  function init() {
    loadTasks();
    buildApp();
    renderTasks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
