// Generated using webpack-cli https://github.com/webpack/webpack-cli
import path from "path";
import {fileURLToPath} from 'url';

const isProduction = process.env.NODE_ENV == "production";
const mode = isProduction ? "production" : "development"

const stylesHandler = "style-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '/dist');

export default [{
    mode: mode,
    entry: {
        "serviceworker": "./src/serviceworker.ts"
    },
    output: {
        path: distDir
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: "ts-loader",
                exclude: ["/node_modules/"],
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
}, {
    mode: mode,
    experiments: {
        outputModule: true,
    },
    entry: {
        "swinstall": "./src/swinstall.ts",
        "hello": "./src/hello.ts"
    },
    output: {
        path: distDir,
        library: {
            type: "module",
        }
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: "ts-loader",
                exclude: ["/node_modules/"],
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".jsx", ".js"],
    },
    optimization: {
        splitChunks: {
            chunks: 'all',
        },
    },
}];
