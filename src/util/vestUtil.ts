export abstract class VestUtil {
    public static enumFromStringValue<T> (enm: { [s: string]: T}, value: string): T | undefined {
        return (Object.values(enm) as unknown as string[]).includes(value)
            ? value as unknown as T
            : undefined;
    }

    public static removeCapitalization(str: string): string {
        if (str.length === 0) return str; // return empty string if input is empty

        const firstLetter = str.charAt(0); // get the first character of the string
        const restOfString = str.slice(1); // get the remaining part of the string

        return firstLetter.toLowerCase() + restOfString; // convert the first letter to lowercase and concatenate with the rest of the string
    }

    public static toSpaceSeparated(str: string): string {
        let spacedString = str.replace(/([a-z])([A-Z])/g, '$1 $2');
        spacedString = spacedString.replace(/_/g, ' ');
        return spacedString.toLowerCase();
    }

}
