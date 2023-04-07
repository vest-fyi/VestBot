export class InvalidEntityError extends Error {
  constructor(message) {
    super(message);

    // TODO: determine if necessary
    this.name = this.constructor.name; // Set the name property to match the class name

    // TODO: determine if necessary
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}
