/** One browser's room mutations use the snapshot accepted by the preceding request. */
export class RoomMutationQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(mutation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(mutation);
    this.tail = result.then(() => {}, () => {});
    return result;
  }
}
