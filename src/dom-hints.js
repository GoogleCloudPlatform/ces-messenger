import { Logger } from '@/logger.js';
const logger = new Logger();
/**
 * A class to track a DOM element and retrieve its content.
 */
export class DomHintTracker {
  /**
   * Constructor to set up the DOM hint.
   * @param {object} options - The options for the DOM hint.
   * @param {function} options.setQueryParameters - The function to call to set query parameters.
   * @param {string} [options.varName="current_user_html"] - The name to be used as a key for the hint.
   * @param {string} [options.selector] - The CSS selector for the DOM element to be targeted. Defaults to 'body' if no element is provided.
   * @param {HTMLElement} [options.element] - The DOM element to be targeted.
   */
  constructor(options = {}) {
    const {
      setQueryParameters,
      varName = 'current_user_html',
      selector,
      element,
    } = options;

    if (typeof setQueryParameters !== 'function') {
      throw new Error('DomHintTracker: A valid setQueryParameters function must be provided.');
    }

    /** @private */
    this.setQueryParameters = setQueryParameters;
    /** @private */
    this.varName = varName;
    /** @private */
    this.selector = selector || (element ? undefined : 'body');
    /** @private */
    this.element = element;

    if (this.element) {
      logger.info(
        `DomHintTracker initialized to track a DOM element into variable "${this.varName}".`
      );
    } else {
      logger.info(
        `DomHintTracker initialized to track selector "${this.selector}" into variable "${this.varName}".`
      );
    }
  }

  /**
   * Updates the queryVars object with the current innerHTML of the tracked DOM element.
   *
   * @param {object} [options={}] - Optional parameters for the update.
   * @param {string} [options.selector] - An optional CSS selector to use, overriding the one from the configuration.
   * @param {HTMLElement} [options.element] - An optional DOM element to use, overriding the one from the configuration.
   * @returns {void}
   */
  update(options = {}) {
    const { selector: overrideSelector, element: overrideElement } = options;
    const elementToUse = overrideElement || this.element;
    const selectorToUse = overrideSelector || this.selector;

    const targetElement =
      elementToUse || (selectorToUse && document.querySelector(selectorToUse));
    let content = '';

    if (targetElement) {
      content = targetElement.innerHTML;
      logger.info(`DomHintTracker.update: Successfully updated variable "${this.varName}" from selector "${selectorToUse}".`);
    } else {
      logger.warn(`DomHintTracker.update: Cannot update DOM hints. Element not found for: "${selectorToUse}".`);
    }

    this.setQueryParameters({ [this.varName]: content });
  }
}

/**
 * A factory for creating DomHintTracker instances that are pre-configured
 * with a specific queryVars object.
 */
export class DomHintTrackerFactory {
  /**
   * @param {function} setQueryParameters The function that all created trackers will use.
   */
  constructor(setQueryParameters) {
    /** @private */
    this.setQueryParameters = setQueryParameters;
  }

  /**
   * Creates a new DomHintTracker instance.
   * @param {object} options - The options for the tracker, excluding `setQueryParameters`.
   * @returns {DomHintTracker}
   */
  create(options) {
    return new DomHintTracker({ ...options, setQueryParameters: this.setQueryParameters });
  }
}
