import moment from "moment";

export const loadScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        var e = document.createElement("script");
        e.onload = () => {
            resolve();
        };
        e.src = url;
        e.async = true;
        document.getElementsByTagName("head")[0].appendChild(e);
    });
}

export const getEnvVariable = (key: string, defaultValue?: any): any | undefined => {
    return process.env[key] ? process.env[key] : defaultValue;
}

export interface CancelablePromise<T = any> {
    promise: Promise<T>;
    cancel(): void;
}

export const makeCancelable = <T>(promise: Promise<T>): CancelablePromise => {
    let hasCanceled = false;

    const wrappedPromise = new Promise<T>((resolve, reject) => {
        promise.then(
            value => hasCanceled
                ? reject({ isCanceled: true })
                : resolve(value),
            error => hasCanceled
                ? reject({ isCanceled: true })
                : reject(error),
        ).catch((error) => hasCanceled ? reject({ isCanceled: true }) : reject(error));
    });

    return {
        promise: wrappedPromise,
        cancel(): void {
            hasCanceled = true;
        },
    };
};

export const camelToTitleCase = (rawString: string) => {
    return rawString
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, inputString => inputString.toUpperCase());
}

export const isString = (testObject: any) => {
    return typeof testObject === "string";
}

export const toTwoDigitString = (value: number) => {
    const twoDigitString = `0${value}`;
    return twoDigitString.substr(twoDigitString.length - 2);
}

export const downloadDataToFile = (fileName: string, prefix: string, content: string, target = "_blank") => {
    const a = document.createElement('a');
    a.download = fileName;
    const encodedContent = encodeURIComponent(content);
    a.href = prefix + encodedContent;
    a.target = target;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Checks if an object:
 * 1. Has typeof 'object'
 * 2. Not null
 * 3. Not an array
 * @param {any} val
 */
export const isObject = (val: any) => {
    return (val !== null) && (typeof val === 'object') && (!Array.isArray(val));
}

export const deepCopyObject = (obj: any, hash = new WeakMap()): any => {
    // Do not try to clone primitives or functions
    if (Object(obj) !== obj || obj instanceof Function) {
        return obj;
    }
    if (hash.has(obj)) {
        return hash.get(obj); // Cyclic reference
    }
    let result: any;
    try { // Try to run constructor (without arguments, as we don't know them)
        result = new obj.constructor();
    } catch (e) { // Constructor failed, create object without running the constructor
        result = Object.create(Object.getPrototypeOf(obj));
    }
    // Optional: support for some standard constructors (extend as desired)
    if (obj instanceof Map) {
        Array.from(obj, ([key, val]) => result.set(deepCopyObject(key, hash),
            deepCopyObject(val, hash)));
    } else if (obj instanceof Set) {
        Array.from(obj, (key) => result.add(deepCopyObject(key, hash)));
    }
    // Register in hash
    hash.set(obj, result);
    // Clone and assign enumerable own properties recursively
    return Object.assign(result, ...Object.keys(obj).map(
        key => ({ [key]: deepCopyObject(obj[key], hash) })));
}

export const isDeepEqual = (objA: any, objB: any) => {
    if (objA === objB) return true;

    if (
        typeof objA !== 'object' || typeof objB !== 'object' ||
        objA == null || objB == null
    ) {
        return false;
    }

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    let result = true;

    keysA.forEach((key) => {
        if (!keysB.includes(key)) {
            result = false;
        }

        if (typeof objA[key] === 'function' || typeof objB[key] === 'function') {
            if (objA[key].toString() !== objB[key].toString()) {
                result = false;
            }
        }

        if (!isDeepEqual(objA[key], objB[key])) {
            result = false;
        }
    });

    return result;
}

/**
 * Remove the keys from an object that:
 * 1. Has value of undefined
 * 2. Has value of null
 * 3. Has value of NaN
 *
 * This method mutates the input object.
 * @param {any} object
 */
export const removeFalsyKeys = (object: any) => {
    if (!isObject(object)) {
        return;
    }
    Object.keys(object).forEach(key => {
        let filterValue = object[key];

        if (typeof filterValue === "object") {
            removeFalsyKeys(filterValue)
        }

        if (filterValue === "" || filterValue === undefined || filterValue === null || (typeof filterValue === 'number' && isNaN(filterValue)) ||
            (Array.isArray(filterValue) && filterValue.length === 0) || (typeof filterValue === "object" && Object.keys(filterValue).length === 0)) {
            delete object[key];
        }

    });
}


/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep(target: any, ...sources: any[]): any {

    function _isObject(item: any) {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }

    if (!sources.length) return target;
    const source = sources.shift();

    if (_isObject(target) && _isObject(source)) {
        for (const key in source) {
            if (_isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}


/**
 * Remove duplicate values from an array.
 * @param array Source array
 * @param sortFunction Function to use when sorting the array
 * @returns Source array with duplicates removed and sorted
 */
export function removeDuplicates(array: any[], sortFunction?: ((a: any, b: any) => number)): any[] {
    return array.filter(function (item, pos) {
        return array.indexOf(item) === pos;
    }).sort(sortFunction);
}

/**
 * Add thousand separators to a numerical value.
 * @param {String} value
 */
export const addThousandSeparator = (value: string) => {
    const firstdot = value.indexOf('.');
    if (firstdot !== -1) {
        const firstPart = value.substr(0, firstdot).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return firstPart + value.substr(firstdot);
    }
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Move a element in an array. This will change the given array.
 * @param {any[]} arr Input array
 * @param {Number} fromIndex From index
 * @param {Number} toIndex To Index
 */
export const arrayMove = (arr: any[], fromIndex: number, toIndex: number) => {
    const element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
}

/**
 * Reset the time portion in a Moment object.
 * @param {moment.Moment} momentInst Moment object that should be reset
 * @example
 * momentObj.format('YYYY-MM-DD HH:mm:ss')
 * // returns "2020-08-20 11:53:06"
 * 
 * const newObj = resetTimeInMomentObj(momentObj)
 * newObj.format('YYYY-MM-DD HH:mm:ss')
 * // returns "2020-08-20 00:00:00"
 */
export const resetTimeInMomentObj = (momentInst: moment.Moment) => {
    momentInst.hours(0);
    momentInst.minutes(0);
    momentInst.seconds(0);
    momentInst.milliseconds(0);
    return momentInst;
}

/**
 * Compare two arrays.
 * @param {any[]} array1 Input array 1
 * @param {any[]} array2 Input array 2
 */
export const arrayCompare = (array1: any[], array2: any[]): boolean => {
    if (
        !Array.isArray(array1)
        || !Array.isArray(array2)
        || array1.length !== array2.length
    ) {
        return false;
    }

    // .concat() to not mutate arguments
    const arr1 = array1.concat().sort();
    const arr2 = array2.concat().sort();

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Format a number of seconds into a given format of time
 * @param {number} seconds Number of seconds
 * @param {string} format Required time format
 */
export const getTimeFromSeconds = (seconds: number, format?: 'HH:MM:SS' | 'MM:SS' | 'SS') => {
    switch (format) {
        case "HH:MM:SS":
            return moment("2015-01-01").startOf('day').seconds(seconds).format('H:mm:ss');
        case "SS":
            return moment("2015-01-01").startOf('day').seconds(seconds).format('ss');
        case "MM:SS":
        default:
            return moment("2015-01-01").startOf('day').seconds(seconds).format('mm:ss');
    }
}

/**
 * Format a number to have k, m, b t at the end depending on the value
  * @param {number} value Number to format 
  * @param {number} startingValue Number to start the formatting 
 */
export const abbreviateNumber = (value: number, startingValue = 10000): string => {
    if (value >= startingValue) {
        let suffixes = ["", "K", "M", "B", "T"];
        let suffixNum = Math.floor(("" + value).length / 3);
        let shortValue = 0;
        for (let precision = 2; precision >= 1; precision--) {
            shortValue = parseFloat((suffixNum !== 0 ? (value / Math.pow(1000, suffixNum)) : value).toPrecision(precision));
            var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g, '');
            if (dotLessShortValue.length <= 2) { break; }
        }

        if (shortValue % 1 !== 0) {
            shortValue = Number(shortValue.toFixed(1));
        }

        return shortValue + suffixes[suffixNum];
    }

    return addThousandSeparator(String(value));
}

/**
 * Get the number of decimal places in a given number
  * @param {number} value Number to get the decimal place count
 */
export const countDecimals = (value: number): number => {
    if (Math.floor(value) === value) return 0;
    return value.toString().split(".")[1].length || 0;
}

export const isElectron = () => {
    return false;
    // return !!process.versions['electron'];
}


export const transformDate = (value: any, formatter: string = "YYYY-MM-DD HH:mm:ss") => {
    const num = Number(value);
    if (isNaN(num)) {
        return '';
    }

    const date = new Date(num);
    return moment(date).format(formatter);
}
