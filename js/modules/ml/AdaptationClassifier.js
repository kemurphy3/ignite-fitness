import TrendAnalyzer from './TrendAnalyzer.js';

/**
 * AdaptationClassifier - combines unsupervised and supervised ML techniques
 * to categorize training responses, predict plateaus, and assess injury risk.
 */
class AdaptationClassifier {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.k = options.k ?? 3;
        this.maxIterations = options.maxIterations ?? 100;
        this.learningRate = options.learningRate ?? 0.05;
        this.trendAnalyzer = options.trendAnalyzer || new TrendAnalyzer(this.logger);
        this.random = options.random || Math.random;
    }

    #normalizeDataset(dataset, keys) {
        if (!Array.isArray(dataset) || dataset.length === 0) {
            throw new Error('Dataset must be a non-empty array');
        }
        const normalized = dataset.map(entry => {
            const normalizedEntry = {};
            keys.forEach(key => {
                const value = Number(entry[key]);
                if (!Number.isFinite(value)) {
                    throw new Error(`Missing numeric value for ${key}`);
                }
                normalizedEntry[key] = value;
            });
            return normalizedEntry;
        });
        return normalized;
    }

    runKMeans(dataset, keys) {
        const data = this.#normalizeDataset(dataset, keys);
        const centroids = this.#initializeCentroids(data);
        let assignments = new Array(data.length).fill(-1);

        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            const newAssignments = data.map(point => this.#closestCentroid(point, centroids, keys));
            if (newAssignments.every((value, index) => value === assignments[index])) {
                break; // convergence
            }
            assignments = newAssignments;
            this.#updateCentroids(data, assignments, centroids, keys);
        }

        const clusters = centroids.map(() => []);
        data.forEach((point, index) => {
            clusters[assignments[index]].push(point);
        });

        const silhouette = this.#silhouetteScore(data, assignments, centroids, keys);

        return {
            centroids,
            assignments,
            clusters,
            silhouette
        };
    }

    trainLogisticRegression(dataset, labelKey, featureKeys, iterations = 500) {
        const data = this.#normalizeDataset(dataset, [...featureKeys, labelKey]);
        const weights = new Array(featureKeys.length).fill(0);
        let bias = 0;

        for (let iteration = 0; iteration < iterations; iteration++) {
            let gradientBias = 0;
            const gradientWeights = new Array(featureKeys.length).fill(0);

            data.forEach(entry => {
                const features = featureKeys.map(key => entry[key]);
                const linear = this.#dotProduct(weights, features) + bias;
                const prediction = 1 / (1 + Math.exp(-linear));
                const error = prediction - Number(entry[labelKey]);
                gradientBias += error;
                featureKeys.forEach((key, index) => {
                    gradientWeights[index] += error * entry[key];
                });
            });

            const scale = this.learningRate / data.length;
            bias -= scale * gradientBias;
            gradientWeights.forEach((grad, index) => {
                weights[index] -= scale * grad;
            });
        }

        return { weights, bias };
    }

    decisionTreeClassifier(dataset, labelKey, featureKeys, depth = 3) {
        const data = this.#normalizeDataset(dataset, [...featureKeys, labelKey]);
        const tree = this.#buildTree(data, featureKeys, labelKey, depth);
        return tree;
    }

    randomForest(dataset, labelKey, featureKeys, trees = 5, depth = 3) {
        const models = [];
        for (let i = 0; i < trees; i++) {
            const bootstrap = this.#bootstrapSample(dataset);
            const sampledFeatures = this.#sampleFeatures(featureKeys);
            const tree = this.decisionTreeClassifier(bootstrap, labelKey, sampledFeatures, depth);
            models.push({ tree, features: sampledFeatures });
        }
        return models;
    }

    predictRandomForest(models, sample) {
        const votes = {};
        models.forEach(model => {
            const prediction = this.#predictTree(model.tree, sample, model.features);
            votes[prediction] = (votes[prediction] || 0) + 1;
        });
        return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
    }

    #initializeCentroids(data) {
        const centroids = [];
        const usedIndexes = new Set();
        while (centroids.length < this.k) {
            const index = Math.floor(this.random() * data.length);
            if (!usedIndexes.has(index)) {
                centroids.push({ ...data[index] });
                usedIndexes.add(index);
            }
        }
        return centroids;
    }

    #closestCentroid(point, centroids, keys) {
        let bestIndex = 0;
        let bestDistance = Infinity;
        centroids.forEach((centroid, index) => {
            const distance = this.#euclidean(point, centroid, keys);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });
        return bestIndex;
    }

    #updateCentroids(data, assignments, centroids, keys) {
        centroids.forEach((centroid, clusterIndex) => {
            const clusterPoints = data.filter((_, index) => assignments[index] === clusterIndex);
            if (clusterPoints.length === 0) {return;}
            keys.forEach(key => {
                centroid[key] = clusterPoints.reduce((sum, point) => sum + point[key], 0) / clusterPoints.length;
            });
        });
    }

    #silhouetteScore(data, assignments, centroids, keys) {
        const scores = data.map((point, index) => {
            const clusterIndex = assignments[index];
            const ownCluster = data
                .map((other, otherIndex) => assignments[otherIndex] === clusterIndex ? other : null)
                .filter(Boolean);
            const otherClusters = centroids.map((_, centroidIndex) =>
                centroidIndex === clusterIndex
                    ? null
                    : data.filter((__, otherIndex) => assignments[otherIndex] === centroidIndex)
            );

            const a = ownCluster.length > 1
                ? ownCluster
                    .filter((_, i) => i !== index)
                    .reduce((sum, other) => sum + this.#euclidean(point, other, keys), 0) / (ownCluster.length - 1)
                : 0;

            const bValues = otherClusters
                .filter(cluster => Array.isArray(cluster) && cluster.length > 0)
                .map(cluster => cluster.reduce((sum, other) => sum + this.#euclidean(point, other, keys), 0) / cluster.length);

            const b = bValues.length > 0 ? Math.min(...bValues) : 0;

            if (a === 0 && b === 0) {return 0;}
            return (b - a) / Math.max(a, b);
        });

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    #buildTree(dataset, featureKeys, labelKey, depth) {
        const labels = dataset.map(entry => entry[labelKey]);
        const uniqueLabels = [...new Set(labels)];
        if (depth === 0 || uniqueLabels.length === 1) {
            const majority = uniqueLabels.sort((a, b) =>
                labels.filter(label => label === b).length - labels.filter(label => label === a).length
            )[0];
            return { type: 'leaf', prediction: majority };
        }

        let bestFeature = null;
        let bestThreshold = null;
        let bestImpurity = Infinity;
        let bestSplits = null;

        featureKeys.forEach(key => {
            const values = dataset.map(entry => entry[key]);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const step = (max - min) / Math.max(5, Math.floor(values.length / 5));
            if (!Number.isFinite(step) || step === 0) {return;}
            for (let threshold = min + step; threshold < max; threshold += step) {
                const left = dataset.filter(entry => entry[key] <= threshold);
                const right = dataset.filter(entry => entry[key] > threshold);
                if (left.length === 0 || right.length === 0) {continue;}
                const impurity = this.#giniImpurity(left, labelKey) * (left.length / dataset.length) +
                    this.#giniImpurity(right, labelKey) * (right.length / dataset.length);
                if (impurity < bestImpurity) {
                    bestImpurity = impurity;
                    bestFeature = key;
                    bestThreshold = threshold;
                    bestSplits = { left, right };
                }
            }
        });

        if (!bestSplits) {
            const majority = uniqueLabels.sort((a, b) =>
                labels.filter(label => label === b).length - labels.filter(label => label === a).length
            )[0];
            return { type: 'leaf', prediction: majority };
        }

        return {
            type: 'node',
            feature: bestFeature,
            threshold: bestThreshold,
            left: this.#buildTree(bestSplits.left, featureKeys, labelKey, depth - 1),
            right: this.#buildTree(bestSplits.right, featureKeys, labelKey, depth - 1)
        };
    }

    #predictTree(tree, sample, featureKeys) {
        if (tree.type === 'leaf') {
            return tree.prediction;
        }
        const featureValue = Number(sample[tree.feature]);
        if (!Number.isFinite(featureValue)) {
            throw new Error(`Sample missing feature ${tree.feature}`);
        }
        if (featureValue <= tree.threshold) {
            return this.#predictTree(tree.left, sample, featureKeys);
        }
        return this.#predictTree(tree.right, sample, featureKeys);
    }

    #giniImpurity(dataset, labelKey) {
        const labels = dataset.map(entry => entry[labelKey]);
        const total = labels.length;
        const counts = {};
        labels.forEach(label => {
            counts[label] = (counts[label] || 0) + 1;
        });
        return 1 - Object.values(counts).reduce((sum, count) => sum + Math.pow(count / total, 2), 0);
    }

    #bootstrapSample(dataset) {
        const sample = [];
        for (let i = 0; i < dataset.length; i++) {
            const index = Math.floor(this.random() * dataset.length);
            sample.push(dataset[index]);
        }
        return sample;
    }

    #sampleFeatures(featureKeys) {
        const count = Math.max(1, Math.round(Math.sqrt(featureKeys.length)));
        const shuffled = [...featureKeys].sort(() => this.random() - 0.5);
        return shuffled.slice(0, count);
    }

    #dotProduct(a, b) {
        return a.reduce((sum, value, index) => sum + value * b[index], 0);
    }

    #euclidean(a, b, keys) {
        return Math.sqrt(keys.reduce((sum, key) => sum + Math.pow(a[key] - b[key], 2), 0));
    }
}

if (typeof window !== 'undefined') {
    window.AdaptationClassifier = AdaptationClassifier;
}

export default AdaptationClassifier;


