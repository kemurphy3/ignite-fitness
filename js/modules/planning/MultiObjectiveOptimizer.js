/**
 * MultiObjectiveOptimizer - NSGA-II inspired optimizer for balancing multiple fitness goals.
 * Uses Pareto dominance, crowding distance, real-coded crossover and mutation to
 * build concurrent plans for strength, endurance, and body composition goals.
 */
class MultiObjectiveOptimizer {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.populationSize = options.populationSize || 50;
        this.maxGenerations = options.maxGenerations || 80;
        this.crossoverRate = options.crossoverRate || 0.9;
        this.mutationRate = options.mutationRate || 0.15;
        this.mutationScale = options.mutationScale || 0.1;
        this.random = options.random || Math.random;
    }

    optimizeTrainingPlan(goals, constraints, timeHorizon) {
        if (!Array.isArray(goals) || goals.length === 0) {
            throw new Error('At least one goal is required');
        }
        const feasibleConstraints = this.#normalizeConstraints(constraints);
        const objectives = this.defineObjectiveFunctions(goals);
        let population = this.generateInitialSolutions(feasibleConstraints, this.populationSize, timeHorizon);

        for (let generation = 0; generation < this.maxGenerations; generation++) {
            population = this.#evaluatePopulation(population, objectives);
            const fronts = this.fastNonDominatedSort(population);
            const newPopulation = [];

            for (const front of fronts) {
                if (newPopulation.length + front.length <= this.populationSize) {
                    newPopulation.push(...front);
                } else {
                    const sorted = this.crowdingDistanceSort(front);
                    const remaining = this.populationSize - newPopulation.length;
                    newPopulation.push(...sorted.slice(0, remaining));
                    break;
                }
            }

            const offspring = this.generateOffspring(newPopulation, feasibleConstraints, timeHorizon);
            population = [...newPopulation, ...offspring];
        }

        const finalEvaluations = this.#evaluatePopulation(population, objectives);
        finalEvaluations.sort((a, b) => a.rank - b.rank || b.crowdingDistance - a.crowdingDistance);
        return this.selectOptimalSolution(finalEvaluations[0], goals);
    }

    defineObjectiveFunctions(goals) {
        return goals.map(goal => {
            const type = goal.type?.toLowerCase();
            if (type === 'strength') {
                return solution => this.#strengthObjective(solution, goal.priority || 1);
            }
                if (type === 'endurance') {
                return solution => this.#enduranceObjective(solution, goal.priority || 1);
            }
            if (type === 'body-composition') {
                return solution => this.#compositionObjective(solution, goal.priority || 1);
            }
            if (type === 'speed' || type === 'agility') {
                return solution => this.#speedObjective(solution, goal.priority || 1);
            }
            return () => 0;
        });
    }

    generateInitialSolutions(constraints, size, timeHorizon) {
        const solutions = [];
        for (let i = 0; i < size; i++) {
            solutions.push(this.#randomSolution(constraints, timeHorizon));
        }
        return solutions;
    }

    fastNonDominatedSort(population) {
        const fronts = [[]];
        population.forEach(individual => {
            individual.dominationSet = [];
            individual.dominatedCount = 0;
            population.forEach(other => {
                if (individual === other) {return;}
                if (this.#dominates(individual, other)) {
                    individual.dominationSet.push(other);
                } else if (this.#dominates(other, individual)) {
                    individual.dominatedCount += 1;
                }
            });
            if (individual.dominatedCount === 0) {
                individual.rank = 0;
                fronts[0].push(individual);
            }
        });

        let i = 0;
        while (fronts[i]?.length) {
            const nextFront = [];
            fronts[i].forEach(individual => {
                individual.dominationSet.forEach(other => {
                    other.dominatedCount -= 1;
                    if (other.dominatedCount === 0) {
                        other.rank = i + 1;
                        nextFront.push(other);
                    }
                });
            });
            if (nextFront.length > 0) {
                fronts.push(nextFront);
            }
            i += 1;
        }
        return fronts;
    }

    crowdingDistanceSort(front) {
        const sorted = [...front];
        const objectiveCount = front[0].objectives.length;

        sorted.forEach(individual => {
            individual.crowdingDistance = 0;
        });

        for (let m = 0; m < objectiveCount; m++) {
            sorted.sort((a, b) => a.objectives[m] - b.objectives[m]);
            sorted[0].crowdingDistance = Infinity;
            sorted[sorted.length - 1].crowdingDistance = Infinity;
            const objectiveMin = sorted[0].objectives[m];
            const objectiveMax = sorted[sorted.length - 1].objectives[m];
            if (objectiveMax === objectiveMin) {continue;}
            for (let i = 1; i < sorted.length - 1; i++) {
                const prev = sorted[i - 1].objectives[m];
                const next = sorted[i + 1].objectives[m];
                sorted[i].crowdingDistance += (next - prev) / (objectiveMax - objectiveMin);
            }
        }
        return sorted.sort((a, b) => b.crowdingDistance - a.crowdingDistance);
    }

    generateOffspring(population, constraints, timeHorizon) {
        const offspring = [];
        while (offspring.length < population.length) {
            const parentA = this.#tournamentSelect(population);
            const parentB = this.#tournamentSelect(population);
            let [childA, childB] = [this.#clone(parentA), this.#clone(parentB)];
            if (this.random() < this.crossoverRate) {
                [childA, childB] = this.#crossover(parentA, parentB, timeHorizon);
            }
            childA = this.#mutate(childA, constraints);
            childB = this.#mutate(childB, constraints);
            offspring.push(childA, childB);
        }
        return offspring.slice(0, population.length);
    }

    selectOptimalSolution(individual, goals) {
        const summary = {
            schedule: individual.schedule,
            loadDistribution: individual.loadDistribution,
            fatigueIndex: individual.fatigueIndex,
            interferenceRisk: individual.interferenceRisk,
            objectiveScores: individual.objectives,
            goalsSatisfied: goals.map((goal, index) => ({
                goal,
                score: individual.objectives[index]
            }))
        };
        return summary;
    }

    #normalizeConstraints(constraints = {}) {
        const defaults = {
            maxWeeklySessions: 8,
            maxDailyDuration: 90,
            minRecoveryHours: 12,
            availableEquipment: ['barbell', 'dumbbell', 'track'],
            fatigueCeiling: 0.75,
            sportCalendar: []
        };
        return { ...defaults, ...constraints };
    }

    #evaluatePopulation(population, objectives) {
        return population.map(individual => {
            individual.objectives = objectives.map(fn => fn(individual));
            return individual;
        });
    }

    #randomSolution(constraints, timeHorizon) {
        const days = Math.max(7, timeHorizon || 28);
        const schedule = [];
        const loadDistribution = { strength: 0, endurance: 0, conditioning: 0 };
        let fatigue = 0;

        for (let day = 0; day < days; day++) {
            const modalities = this.#randomModalities();
            const duration = Math.min(constraints.maxDailyDuration, 45 + (this.random() * 45));
            const intensity = 0.65 + (this.random() * 0.3);
            const session = {
                day,
                modalities,
                duration,
                intensity,
                recovery: constraints.minRecoveryHours
            };
            schedule.push(session);
            modalities.forEach(modality => {
                loadDistribution[modality] = (loadDistribution[modality] || 0) + (duration * intensity);
            });
            fatigue += (intensity * duration) / 300;
        }

        fatigue = fatigue / days;
        const interferenceRisk = this.#estimateInterference(loadDistribution);
        return {
            schedule,
            loadDistribution,
            fatigueIndex: fatigue,
            interferenceRisk,
            objectives: [],
            rank: 0,
            crowdingDistance: 0
        };
    }

    #dominates(a, b) {
        const betterInAny = a.objectives.some((value, index) => value > b.objectives[index]);
        const notWorseInAll = a.objectives.every((value, index) => value >= b.objectives[index]);
        return betterInAny && notWorseInAll;
    }

    #strengthObjective(solution, priority) {
        const strengthLoad = solution.loadDistribution.strength || 0;
        const fatiguePenalty = Math.max(0, solution.fatigueIndex - 0.6) * 20;
        const interferencePenalty = solution.interferenceRisk.strengthPenalty * 15;
        return priority * (strengthLoad - fatiguePenalty - interferencePenalty);
    }

    #enduranceObjective(solution, priority) {
        const enduranceLoad = solution.loadDistribution.endurance || 0;
        const glycogenPenalty = solution.interferenceRisk.glycogenStress * 10;
        const fatiguePenalty = Math.max(0, solution.fatigueIndex - 0.55) * 18;
        return priority * (enduranceLoad - glycogenPenalty - fatiguePenalty);
    }

    #compositionObjective(solution, priority) {
        const conditioningLoad = solution.loadDistribution.conditioning || 0;
        const hormonalScore = 1 - solution.interferenceRisk.hormonalConflict;
        const fatiguePenalty = Math.max(0, solution.fatigueIndex - 0.5) * 22;
        return priority * ((conditioningLoad * hormonalScore) - fatiguePenalty);
    }

    #speedObjective(solution, priority) {
        const strengthContribution = (solution.loadDistribution.strength || 0) * 0.6;
        const conditioningContribution = (solution.loadDistribution.conditioning || 0) * 0.4;
        const hormonalPenalty = solution.interferenceRisk.hormonalConflict * 10;
        return priority * (strengthContribution + conditioningContribution - hormonalPenalty);
    }

    #estimateInterference(loadDistribution) {
        const strength = loadDistribution.strength || 0;
        const endurance = loadDistribution.endurance || 0;
        const conditioning = loadDistribution.conditioning || 0;
        const totalLoad = strength + endurance + conditioning + 1e-6;
        const ratio = endurance / (strength + 1e-6);
        const strengthPenalty = Math.min(1, ratio * 0.3);
        const glycogenStress = Math.min(1, (endurance + conditioning) / (totalLoad * 1.2));
        const hormonalConflict = Math.min(1, (strengthPenalty + glycogenStress) / 2);
        return {
            strengthPenalty,
            glycogenStress,
            hormonalConflict
        };
    }

    #tournamentSelect(population, size = 3) {
        const candidates = [];
        for (let i = 0; i < size; i++) {
            const index = Math.floor(this.random() * population.length);
            candidates.push(population[index]);
        }
        candidates.sort((a, b) => a.rank - b.rank || b.crowdingDistance - a.crowdingDistance);
        return candidates[0];
    }

    #clone(individual) {
        return {
            schedule: individual.schedule.map(session => ({
                ...session,
                modalities: [...session.modalities]
            })),
            loadDistribution: { ...individual.loadDistribution },
            fatigueIndex: individual.fatigueIndex,
            interferenceRisk: { ...individual.interferenceRisk },
            objectives: [...individual.objectives],
            rank: individual.rank,
            crowdingDistance: individual.crowdingDistance || 0
        };
    }

    #crossover(parentA, parentB, timeHorizon) {
        const childA = this.#clone(parentA);
        const childB = this.#clone(parentB);
        const point = Math.floor(this.random() * Math.min(parentA.schedule.length, parentB.schedule.length));
        childA.schedule = parentA.schedule.slice(0, point).concat(parentB.schedule.slice(point));
        childB.schedule = parentB.schedule.slice(0, point).concat(parentA.schedule.slice(point));
        childA.loadDistribution = this.#recomputeLoad(childA.schedule);
        childB.loadDistribution = this.#recomputeLoad(childB.schedule);
        childA.fatigueIndex = this.#computeFatigue(childA.schedule, timeHorizon);
        childB.fatigueIndex = this.#computeFatigue(childB.schedule, timeHorizon);
        childA.interferenceRisk = this.#estimateInterference(childA.loadDistribution);
        childB.interferenceRisk = this.#estimateInterference(childB.loadDistribution);
        return [childA, childB];
    }

    #mutate(individual, constraints) {
        const mutated = this.#clone(individual);
        mutated.schedule = mutated.schedule.map(session => {
            let updated = { ...session };
            if (this.random() < this.mutationRate) {
                const factor = 1 + ((this.random() - 0.5) * this.mutationScale);
                updated.intensity = Math.min(0.95, Math.max(0.55, updated.intensity * factor));
                updated.duration = Math.min(constraints.maxDailyDuration, Math.max(30, updated.duration * factor));
            }
            return updated;
        });
        mutated.loadDistribution = this.#recomputeLoad(mutated.schedule);
        mutated.fatigueIndex = this.#computeFatigue(mutated.schedule);
        mutated.interferenceRisk = this.#estimateInterference(mutated.loadDistribution);
        return mutated;
    }

    #recomputeLoad(schedule) {
        const load = { strength: 0, endurance: 0, conditioning: 0 };
        schedule.forEach(session => {
            session.modalities.forEach(modality => {
                load[modality] = (load[modality] || 0) + (session.duration * session.intensity);
            });
        });
        return load;
    }

    #computeFatigue(schedule, timeHorizon = schedule.length) {
        const total = schedule.reduce((sum, session) =>
            sum + (session.duration * session.intensity) / timeHorizon, 0);
        return total / 90;
    }

    #randomModalities() {
        const modalities = [
            ['strength'],
            ['endurance'],
            ['conditioning'],
            ['strength', 'conditioning'],
            ['strength', 'endurance']
        ];
        return modalities[Math.floor(this.random() * modalities.length)];
    }
}

if (typeof window !== 'undefined') {
    window.MultiObjectiveOptimizer = MultiObjectiveOptimizer;
}

export default MultiObjectiveOptimizer;


