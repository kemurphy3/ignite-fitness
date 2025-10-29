/**
 * Webpack Configuration for Tree Shaking and Bundle Optimization
 * Implements dead code elimination and production optimizations
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const isDevelopment = !isProduction;

    return {
        mode: isProduction ? 'production' : 'development',
        
        entry: {
            main: './js/app.js'
            // admin: './js/bundles/admin.js' // Disabled - admin files not yet implemented
        },
        
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash].js' : '[name].js',
            chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
            clean: true,
            publicPath: '/'
        },
        
        optimization: {
            // Enable tree shaking
            usedExports: true,
            sideEffects: false,
            
            // Code splitting
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    // Vendor libraries
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: 10
                    },
                    // Common modules
                    common: {
                        name: 'common',
                        minChunks: 2,
                        chunks: 'all',
                        priority: 5,
                        reuseExistingChunk: true
                    },
                    // AI modules (heavy)
                    ai: {
                        test: /[\\/]js[\\/]modules[\\/]ai[\\/]/,
                        name: 'ai',
                        chunks: 'all',
                        priority: 8
                    },
                    // UI modules
                    ui: {
                        test: /[\\/]js[\\/]modules[\\/]ui[\\/]/,
                        name: 'ui',
                        chunks: 'all',
                        priority: 7
                    },
                    // Sports modules
                    sports: {
                        test: /[\\/]js[\\/]modules[\\/]sports[\\/]/,
                        name: 'sports',
                        chunks: 'all',
                        priority: 6
                    }
                }
            },
            
            // Minimization
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            drop_console: isProduction,
                            drop_debugger: isProduction,
                            pure_funcs: isProduction ? ['console.log', 'console.info'] : []
                        },
                        mangle: {
                            reserved: ['$', 'jQuery', 'window', 'document']
                        }
                    },
                    extractComments: false
                }),
                new CssMinimizerPlugin()
            ]
        },
        
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    targets: {
                                        browsers: ['> 1%', 'last 2 versions', 'not dead']
                                    },
                                    modules: false // Important for tree shaking
                                }]
                            ],
                            plugins: [
                                '@babel/plugin-syntax-dynamic-import',
                                '@babel/plugin-transform-optional-chaining',
                                '@babel/plugin-transform-nullish-coalescing-operator'
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                postcssOptions: {
                                    plugins: [
                                        'autoprefixer',
                                        'cssnano'
                                    ]
                                }
                            }
                        }
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[name].[contenthash][ext]'
                    }
                },
                {
                    test: /\.(woff|woff2|eot|ttf|otf)$/i,
                    type: 'asset/resource',
                    generator: {
                        filename: 'fonts/[name].[contenthash][ext]'
                    }
                }
            ]
        },
        
        plugins: [
            new HtmlWebpackPlugin({
                template: './index.html',
                filename: 'index.html',
                chunks: ['main', 'vendors', 'common', 'ui'],
                minify: isProduction ? {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true
                } : false
            }),
            
            new HtmlWebpackPlugin({
                template: './admin.html',
                filename: 'admin.html',
                chunks: ['admin', 'vendors', 'common'],
                minify: isProduction ? {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true
                } : false
            }),
            
            new MiniCssExtractPlugin({
                filename: isProduction ? '[name].[contenthash].css' : '[name].css',
                chunkFilename: isProduction ? '[name].[contenthash].chunk.css' : '[name].chunk.css'
            }),
            
            // Bundle analyzer for development
            ...(isDevelopment ? [
                new BundleAnalyzerPlugin({
                    analyzerMode: 'server',
                    openAnalyzer: false,
                    analyzerPort: 8888
                })
            ] : [])
        ],
        
        resolve: {
            extensions: ['.js', '.json'],
            alias: {
                '@': path.resolve(__dirname, 'js'),
                '@modules': path.resolve(__dirname, 'js/modules'),
                '@ui': path.resolve(__dirname, 'js/modules/ui'),
                '@ai': path.resolve(__dirname, 'js/modules/ai'),
                '@sports': path.resolve(__dirname, 'js/modules/sports'),
                '@utils': path.resolve(__dirname, 'js/modules/utils')
            }
        },
        
        devtool: isProduction ? 'source-map' : 'eval-source-map',
        
        devServer: {
            static: {
                directory: path.join(__dirname, 'dist')
            },
            compress: true,
            port: 3000,
            hot: true,
            historyApiFallback: true
        },
        
        performance: {
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 512000, // 500KB
            maxAssetSize: 250000 // 250KB
        }
    };
};
