class InMemoryJobHelper {
  static compare(a, b) {
    if (a.priority > b.priority) {
      return 1
    }
    if (a.priority < b.priority) {
      return -1
    }
    if (a.createdAt > b.createdAt) {
      return 1
    }
    if (a.createdAt < b.createdAt) {
      return -1
    }
    return 0
  }
}

export default InMemoryJobHelper
