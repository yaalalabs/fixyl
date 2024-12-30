import siMessage from "./languages/si.json";
import enMessage from "./languages/en.json";
import intl from 'react-intl-universal';
import { Subject, Observable } from "rxjs";
import { mergeDeep } from "src/utils/utils";

export interface LanguageMetaData {
    name: string,
    locale: string,
    shortName: string,
    flag: any
}

export enum LanguageCodes {
    SINHALA = 'si',
    ENGLISH = 'en'
}

export interface LanguageData {
    code: LanguageCodes,
    locale: any,
    meta: LanguageMetaData
}

export class LanguageManager {

    static getInstance(): LanguageManager {
        if (!this.inst) {
            this.inst = new LanguageManager();
        }

        return this.inst;
    }

    private static inst: LanguageManager;
    private language_key = "P8_LANG";
    private currentLanguage: LanguageCodes = localStorage.getItem(this.language_key) as LanguageCodes ?? LanguageCodes.ENGLISH;
    private locales: any;
    private languageMap = new Map<LanguageCodes, LanguageMetaData>();
    private languageChangeSub = new Subject<LanguageCodes>();

    constructor() {
        this.setupLanguageDictionary();
        this.setupLanguageMetaData();
    }

    init(languageData?: LanguageData[]): Promise<void> {
        if (languageData) {
            this.reInitLanguageData(languageData)
        }

        return new Promise((resolve) => {
            intl.init({
                currentLocale: this.currentLanguage,
                locales: this.locales
            }).then(() => {
                resolve();
            });
        });
    }

    getLanguageChangeObservable(): Observable<LanguageCodes> {
        return this.languageChangeSub.asObservable();
    }

    getAllLanguageMetaData(): LanguageMetaData[] {
        return Array.from(this.languageMap.values());
    }

    getLanguageMetaData(language: LanguageCodes): LanguageMetaData | undefined {
        return this.languageMap.get(language);
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    switchLanguage(language: LanguageCodes): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.getCurrentLanguage() !== language) {
                this.setLanguage(language);
                intl.init({
                    currentLocale: language,
                    locales: this.locales
                }).then(() => {
                    this.languageChangeSub.next(language);
                    resolve();
                });

            } else {
                resolve();
            }
        });
    }

    private reInitLanguageData(languageData: LanguageData[]) {
        languageData.forEach(data => {
            this.languageMap.set(data.code, data.meta);
            const currentLocale = this.locales[data.meta.locale];
            if (currentLocale) {
                this.locales[data.meta.locale] = mergeDeep(currentLocale, data.locale);
            } else {
                this.locales[data.meta.locale] = data.locale;
            }
        })
    }

    private setLanguage(language: LanguageCodes) {
        this.currentLanguage = language;
        localStorage.setItem(this.language_key, language);
        document.documentElement.lang = language;
    }

    private setupLanguageDictionary() {
        this.locales = {
            'en': enMessage,
            'si': siMessage
        };
    }

    private setupLanguageMetaData() {
        this.languageMap.set(LanguageCodes.ENGLISH, {
            name: 'English',
            locale: 'en',
            shortName: 'EN',
            flag: ""
        });

        this.languageMap.set(LanguageCodes.SINHALA, {
            name: 'සිංහල',
            locale: 'si',
            shortName: 'SI',
            flag: ""
        });
    }

    getMessage(key: string, params?: any): string {
        return intl.get(key, params);
    }

    getMessageWithDefault(key: string, defaultMessage: string, params?: any) {
        return intl.get(key, params).d(defaultMessage);
    }
}

export const LM = LanguageManager.getInstance();