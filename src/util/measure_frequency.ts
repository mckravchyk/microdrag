interface Options {
  /**
   * When the time elapsed since the last measure() is greater than this,
   * the measure() will be ignored
   *
   * The default value is 50ms
   */
  maxInterval?: number

  /**
   * How many measure() are required to calculate the average
   *
   * The default value is 100
   */
  requiredDataPoints?: number

  /**
   * A callback function to fire when the values are calculated
   *
   * The this object is populated with: averageInterval, averageFrequency, timeSum and measureCount
   * TODO: Make it as an event? So the context is known.
   */
  onCalculated?: Function
}

interface Callbacks {
  [key: string]: Function
}

/**
 * A class utility to calculate the average frequency of an event
 */
class MeasureFrequency {
  /**
   * When the time elapsed since the last measure() is greater than this,
   * the measure() will be ignored
   *
   * This value is measured in ms
   */
  private maxInterval = 50;

  /**
   * How many measure() are required to calculate the average
   */
  private requiredDataPoints = 100;

  /**
   * Contains the timestamp of the last measure()
   */
  private lastTimestamp = 0;

  /**
   * How many measure() were performed
   */
  private measureCount = 0;

  /**
   * The sum of all measured times
   */
  private timeSum = 0;

  /**
   * The average interval between measure()
   *
   * This is calculated when measureCount === requiredDataPoints
   */
  private averageInterval: number|null = null;

  /**
   * The calculated average frequency of the measured event
   *
   * This is calculated when measureCount === requiredDataPoints
   */
  private averageFrequency: number|null = null;

  /**
   * A container for callback functions
   */
  private callbacks : Callbacks = { };

  /**
   *
   * @param options MeasureIntervalOptionss
   */
  public constructor(options? : Options) {
    if (typeof options === 'undefined') {
      options = {};
    }
    if (typeof options.maxInterval !== 'undefined') {
      this.maxInterval = options.maxInterval;
    }
    if (typeof options.requiredDataPoints !== 'undefined') {
      this.requiredDataPoints = options.requiredDataPoints;
    }
    if (typeof options.onCalculated !== 'undefined') {
      this.callbacks.onCalculated = options.onCalculated;
    }
  }

  /**
   * Measure the interval since the last measure() call
   *
   * Note: This function will throw an error if the interval is already calculated
   */
  public measure() : void {
    if (this.averageInterval !== null) {
      throw new Error('The rate is already calculated');
    }

    // How much time since the last measure
    const timeElapsed = performance.now() - this.lastTimestamp;

    // Update last timestamp
    this.lastTimestamp = performance.now();

    // Don't measure this if the time elapsed is greater than the maxInterval set
    if (timeElapsed > this.maxInterval) {
      return;
    }

    // Add data point
    this.measureCount += 1;
    this.timeSum += timeElapsed;

    if (this.measureCount === this.requiredDataPoints) {
      this.calculateResults();
    }
  }

  private calculateResults() {
    this.averageInterval = this.timeSum / this.measureCount;
    this.averageFrequency = 1000 / this.averageInterval;

    if (typeof this.callbacks.onCalculated !== 'undefined') {
      // TODO: Expose these variables via a function argument instead
      this.callbacks.onCalculated.call({
        averageInterval: this.averageInterval,
        averageFrequency: this.averageFrequency,
        timeSum: this.timeSum,
        measureCount: this.measureCount,
      });
      // Destroy the callback reference as it will not be required any longer
      // this.callbacks.onCalculated = null;
      delete this.callbacks.onCalculated;
    }
  }

  /**
   * Whether the measure values are calculated
   */
  public isCalculated(): boolean {
    return (this.averageInterval !== null);
  }

  /**
   * Get the average interval
   *
   * Warning: If the frequency is not calculated yet, the return value is null
   */
  public getAverageInterval() : number | null {
    return this.averageInterval;
  }

  /**
   * Get the average frequency of the event
   *
   * Warning: If the frequency is not calculated yet, the return value is null
   */
  public getAverageFrequency() : number | null {
    return this.averageFrequency;
  }
}

export { MeasureFrequency };
export type { Options as MeasureFrequencyOptions };
