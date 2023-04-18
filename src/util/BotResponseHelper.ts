/**
 * Helper class for working with activities (i.e., formatted bot responses).
 */
export abstract class BotResponseHelper {
    /**
     * Creates an ascii table from the given header and data.
     * @description a workaround in absence of adaptivecards tables
     * if header exists, assume header column count is the max column count for data
     *
     * @param header optional header row
     * @param data
     */
    static createAsciiTable(data: any[][], header?: string[]): string {
        // Determine the maximum width of each column
        let columnWidths: number[];
        if (header) {
            columnWidths = header.map((h, i) => {
                const dataWidths = data.map((row) => String(row[i]).length);
                const maxWidth = Math.max(h.length, ...dataWidths);
                return maxWidth;
            });
        } else {
            const maxColumnCount = data.reduce((max, row) => Math.max(max, row.length), 0);
            columnWidths = data.reduce((acc, row) => {
                row.forEach((cell, i) => {
                    acc[i] = Math.max(acc[i], cell.length);
                });
                return acc;
            }, new Array(maxColumnCount).fill(0));
        }

        // Create the separator row
        const separator = `+${columnWidths.map((w) => '-'.repeat(w + 2)).join('+')}+\n`;

        // Create the header row
        let table = '';
        if (header) {
            table += separator;
            table += `|${header.map((h, i) => ` ${h.padEnd(columnWidths[i])} |`).join('')}\n`;
            table += separator;
        } else {
            table += separator;
        }

        // Create the data rows
        data.forEach((row) => {
            table += `|${row.map((cell, i) => ` ${String(cell).padEnd(columnWidths[i])} |`).join('')}\n`;
            table += separator;
        });

        return table;
    }

    /**
     * Formats a long decimal into easy to read text with 3 decimal places
     * @description e.g. 1123500 -> 1.124 million
     * @param num
     */
    static getLargeNumberFormat(num: number): string {
        if (num < 9999) {
            return num.toString();
        }
        const suffixes = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion', 'Quintillion'];
        const suffixIndex = Math.floor(Math.log10(num) / 3);
        const suffix = suffixes[suffixIndex];
        const shortNumber = (num / Math.pow(1000, suffixIndex)).toFixed(3).replace(/\.?0+$/, '');

        return `${shortNumber} ${suffix}`.trim();
    }
}

// adaptivecards table non-functional example
// const text = 'Here is a table of some data:';
// const tableData = [
//     { name: 'Item 1', price: 10 },
//     { name: 'Item 2', price: 20 },
//     { name: 'Item 3', price: 30 },
// ];
//
// const card = new AdaptiveCard();
// const textBlock = new TextBlock();
// textBlock.text = text;
// card.addItem(textBlock);
//
// // Create a new table with default columns
// const table = new Table();
//
// const tableRow = new TableRow();
// const cell = new TableCell();
// cell.addItem(new TextBlock('Name'));
// tableRow.addCell(cell);
// const cell2 = new TableCell();
// cell2.addItem(new TextBlock('Price'));
// tableRow.addCell(cell2);
// table.addRow(tableRow);
//
// // Add rows to the table
// for (const data of tableData) {
//     const tableRow = new TableRow();
//     const cell = new TableCell();
//     cell.addItem(new TextBlock(data.name));
//     tableRow.addCell(cell);
//     const cell2 = new TableCell();
//     cell2.addItem(new TextBlock(data.price.toString()));
//     tableRow.addCell(cell2);
//     table.addRow(tableRow);
// }
//
// card.addItem(table);
//
// const adaptiveCardAttachment = CardFactory.adaptiveCard(card);
// const message = MessageFactory.attachment(
//   adaptiveCardAttachment
// );
//
// await stepContext.context.sendActivity(message);
