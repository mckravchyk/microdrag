export type CalculationResult = {
  /**
   * The average frequency of the event (Hz).
   */
  averageFrequency: number

  /**
   * The average interval between events.
   */
  averageInterval: number

  /**
   * Total time sum, measured in miliseconds.
   */
  timeSum: number

  /**
   * Total number of measures performed. It does not include measure attempts skipped due to
   * exceeding the max interval.
   */
  measureCount: number
}

export interface Options {
  /**
   * The measure attempt will be ignored if the time elapsed since the last measure is greater than
   * this value.
   *
   * The default value is 50ms.
   */
  maxInterval?: number

  /**
   * How many measures are required to calculate the average.
   *
   * The default value is 100
   */
  requiredDataPoints?: number

  /**
   * A callback function to fire when the values are calculated.
   */
  onCalculated?: (result: CalculationResult) => void
}

interface Callbacks {
  onCalculated?: Options['onCalculated']
}

/**
 * An utility to calculate average interval and frequency of an event.
 */
export class MeasureFrequency {
  private maxInterval = 50;

  private requiredDataPoints = 100;

  private lastTimestamp = 0;

  private measureCount = 0;

  private timeSum = 0;

  private averageInterval: number | null = null;

  private averageFrequency: number | null = null;

  private callbacks : Callbacks = { };

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
   * Measures the interval since the last measure() call. This method must be called when the event
   * is fired.
   *
   * @throws If the interval has been already calculated.
   */
  public measure() : void {
    if (this.averageInterval !== null) {
      throw new Error('The rate is already calculated');
    }

    const timeSinceLastMeasure = performance.now() - this.lastTimestamp;

    this.lastTimestamp = performance.now();

    if (timeSinceLastMeasure > this.maxInterval) {
      return;
    }

    this.measureCount += 1;
    this.timeSum += timeSinceLastMeasure;

    if (this.measureCount === this.requiredDataPoints) {
      this.calculateResults();
    }
  }

  public isCalculated(): boolean {
    return (this.averageInterval !== null);
  }

  /**
   * Gets the average interval. Returns null if the value is not calculated yet.
   */
  public getAverageInterval() : number | null {
    return this.averageInterval;
  }

  /**
   * Gets the average frequency of the event. Returns null if the value is not calculated yet.
   */
  public getAverageFrequency() : number | null {
    return this.averageFrequency;
  }

  private calculateResults() {
    this.averageInterval = this.timeSum / this.measureCount;
    this.averageFrequency = 1000 / this.averageInterval;

    if (typeof this.callbacks.onCalculated !== 'undefined') {
      this.callbacks.onCalculated.call({}, {
        averageInterval: this.averageInterval,
        averageFrequency: this.averageFrequency,
        timeSum: this.timeSum,
        measureCount: this.measureCount,
      });

      delete this.callbacks.onCalculated; // No need to hold on this anymore.
    }
  }
}
