module.exports = {
    roots: ['<rootDir>/src'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        ".+\\.(css|styl|less|sass|scss)$": "<rootDir>/node_modules/jest-css-modules-transform",
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/assetsTransformer.js"
    },
    setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(tsx|ts)?$',
    reporters: [ "default", "jest-junit" ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}