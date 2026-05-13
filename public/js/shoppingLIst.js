function clearCompleted() {
  document
    .querySelectorAll('.ingredient-item input[type="checkbox"]:checked')
    .forEach(function (cb) {
      cb.closest(".ingredient-item").remove();
    });
}
