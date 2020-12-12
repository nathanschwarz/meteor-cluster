class InMemoryJobHelper {
  static compare(a, b) {
    if (a.priority > b.doc.priority) {
      return 1
    }
    if (a.priority < b.doc.priority) {
      return -1
    }
    if (a.createdAt > b.doc.createdAt) {
      return 1
    }
    if (a.createdAt < b.doc.createdAt) {
      return -1
    }
    return 0
  }
}
