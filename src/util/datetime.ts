enum Quarter {
    Q1 = 'Q1',
    Q2 = 'Q2',
    Q3 = 'Q3',
    Q4 = 'Q4',
}

export abstract class DatetimeUtil {
    /**
     * Return the date string in 2022-12-23 format
     *
     * @param date
     * @returns date string in 2022-12-23 format
     * @private
     */
    public static dateToDateString(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    /**
     * Returns the date string in 2022-12-23 format
     * @throws Error if the date is invalid
     * @param dateString
     */
    public static validateDateString(dateString: string): Date {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new Error(
                `Invalid date: ${dateString}. The accepted format is 2023-01-13`
            );
        }

        return date;
    }

    /**
     * Returns Q1-4 for the corresponding dates
     *
     * @throws Error if the date is invalid
     * @param dateString date string in 2022-12-23 format
     * @private
     */
    public static mapDateToQuarter(dateString: string): Quarter {
        const date = DatetimeUtil.validateDateString(dateString);

        switch (Math.floor((date.getMonth() - 1) / 3)) {
            case 0:
                return Quarter.Q1;
            case 1:
                return Quarter.Q2;
            case 2:
                return Quarter.Q3;
            case 3:
                return Quarter.Q4;
            default:
                throw new Error(
                    `Invalid date: ${dateString}. The accepted format is 2023-01-13`
                );
        }
    }

    static quarterEndDateMap: Map<Quarter, string> = new Map([
        [Quarter.Q1, '03-31'],
        [Quarter.Q2, '06-30'],
        [Quarter.Q3, '09-30'],
        [Quarter.Q4, '12-31'],
    ]);

    public static getLastQuarterDateString(): string{
        return this.getPreviousQuarterDateString(DatetimeUtil.dateToDateString(new Date()));
    }

    /**
     * Get previous quarter end date string in 2022-12-23 format
     *
     * @throws Error if the dateString input is invalid
     * @param dateString date string in 2022-12-23 format
     * @private
     */
    public static getPreviousQuarterDateString(dateString: string): string {
        const quarter = DatetimeUtil.mapDateToQuarter(dateString);
        const year = DatetimeUtil.parseYearFromDateString(dateString);

        switch (quarter) {
            case Quarter.Q1:
                return `${year - 1}-${DatetimeUtil.quarterEndDateMap.get(
                    Quarter.Q4
                )}`;
            case Quarter.Q2:
                return `${year}-${DatetimeUtil.quarterEndDateMap.get(
                    Quarter.Q1
                )}`;
            case Quarter.Q3:
                return `${year}-${DatetimeUtil.quarterEndDateMap.get(
                    Quarter.Q2
                )}`;
            case Quarter.Q4:
                return `${year}-${DatetimeUtil.quarterEndDateMap.get(
                    Quarter.Q3
                )}`;
            default:
                throw new Error('Invalid quarter');
        }
    }

    /**
     * Returns the year from the date string
     *
     * @throws Error if the date is invalid
     * @param dateString in the format 2022-12-23
     */
    public static parseYearFromDateString(dateString: string): number {
        const year = dateString.split('-')[0];
        if (year === undefined || year.length !== 4) {
            throw new Error(
                `Invalid date: ${dateString}. The accepted format is 2023-01-13`
            );
        }
        return Number(year);
    }


    public static getCurrentYear(): number {
        return new Date().getFullYear();
    }

    public static getNextYear(): number {
        return this.getCurrentYear() + 1;
    }

    public static getPreviousYear(): number {
        return this.getCurrentYear() - 1;
    }

    public static ifFutureDate(dateString: string): boolean {
        const date = DatetimeUtil.validateDateString(dateString);
        return date.getTime() > new Date().getTime();
    }

}
