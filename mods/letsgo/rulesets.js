'use strict';

/**@type {{[k: string]: ModdedFormatsData}} */
let BattleFormats = {
	pokemon: {
		effectType: 'ValidatorRule',
		name: 'Pokemon',
		onValidateTeam: function (team, format) {
			let problems = [];
			if (team.length > 6) problems.push('Your team has more than six Pok\u00E9mon.');
			// ----------- legality line ------------------------------------------
			if (!format || !this.getRuleTable(format).has('-illegal')) return problems;
			// everything after this line only happens if we're doing legality enforcement
			let hasStarter = 0;
			for (const set of team) {
				if (set.species === 'Pikachu-Starter' || set.species === 'Eevee-Starter') {
					if (hasStarter > 1) {
						problems.push(`You can only have one of Pikachu-Starter and Eevee-Starter on a team.`);
						break;
					}
					hasStarter++;
				}
			}
			return problems;
		},
		onChangeSet: function (set, format) {
			let template = this.getTemplate(set.species);
			let baseTemplate = this.getTemplate(template.baseSpecies);
			let problems = [];
			let totalAV = 0;
			let allowCAP = !!(format && this.getRuleTable(format).has('allowcap'));

			if (set.species === set.name) delete set.name;
			if ((baseTemplate.num > 151 || baseTemplate.num < 1) && ![808, 809].includes(baseTemplate.num) &&
				!['Alola', 'Mega', 'Mega-X', 'Mega-Y', 'Starter'].includes(template.forme)) {
				problems.push(
					`Only Pok\u00E9mon whose base formes are from Gen 1, Meltan, and Melmetal can be used.`,
					`(${baseTemplate.species} is from Gen ${baseTemplate.gen}.)`
				);
			}
			if (set.moves) {
				for (const moveid of set.moves) {
					let move = this.getMove(moveid);
					if (move.gen > this.gen) {
						problems.push(move.name + ' does not exist in gen ' + this.gen + '.');
					} else if (!allowCAP && move.isNonstandard) {
						problems.push(move.name + ' does not exist.');
					}
				}
			}
			if (set.moves && set.moves.length > 4) {
				problems.push((set.name || set.species) + ' has more than four moves.');
			}
			if (set.level && set.level > 100) {
				problems.push((set.name || set.species) + ' is higher than level 100.');
			}

			if (!allowCAP || !template.tier.startsWith('CAP')) {
				if (template.isNonstandard && template.num > -5000) {
					problems.push(set.species + ' does not exist.');
				}
			}

			if (set.evs) {
				for (let k in set.evs) {
					let av = this.getAwakeningValues(set);
					// @ts-ignore
					av[k] = set.evs[k];
					// @ts-ignore
					if (typeof av[k] !== 'number' || av[k] < 0) {
						// @ts-ignore
						av[k] = 0;
					}
					// @ts-ignore
					totalAV += av[k];
				}
			}

			// ----------- legality line ------------------------------------------
			if (!this.getRuleTable(format).has('-illegal')) return problems;
			// everything after this line only happens if we're doing legality enforcement

			// Pokestar studios
			if (template.num <= -5000 && template.isNonstandard) {
				problems.push(`${set.species} cannot be obtained by legal means.`);
			}

			// only in gen 1 and 2 it was legal to max out all EVs
			if (this.gen >= 3 && totalAV > 1200) {
				problems.push((set.name || set.species) + " has more than 1200 total Awakening Values.");
			}
			set.ability = 'No Ability';
			if (set.item) {
				let item = this.getItem(set.item);
				if (item.megaEvolves && item.megaEvolves !== template.baseSpecies) set.item = '';
			}
			set.gender = '';

			// Legendary Pokemon must have at least 3 perfect IVs in gen 6
			if (set.ivs && this.gen >= 6 && (baseTemplate.gen >= 6 || format.requirePentagon) && (template.eggGroups[0] === 'Undiscovered' || template.species === 'Manaphy') && !template.prevo && !template.nfe &&
				// exceptions
				template.species !== 'Unown' && template.baseSpecies !== 'Pikachu' && (template.baseSpecies !== 'Diancie' || !set.shiny)) {
				let perfectIVs = 0;
				for (let i in set.ivs) {
					// @ts-ignore
					if (set.ivs[i] >= 31) perfectIVs++;
				}
				let reason = (format.requirePentagon ? " and this format requires gen " + this.gen + " Pokémon" : " in gen 6");
				if (perfectIVs < 3) problems.push((set.name || set.species) + " must have at least three perfect IVs because it's a legendary" + reason + ".");
			}

			// limit one of each move
			let moves = [];
			if (set.moves) {
				/**@type {{[k: string]: true}} */
				let hasMove = {};
				for (const moveId of set.moves) {
					let move = this.getMove(moveId);
					let moveid = move.id;
					if (hasMove[moveid]) continue;
					hasMove[moveid] = true;
					moves.push(moveId);
				}
			}
			set.moves = moves;

			let battleForme = template.battleOnly && template.species;
			if (battleForme) {
				if (template.isMega) set.species = template.baseSpecies;
				if (template.requiredMove && !set.moves.includes(toId(template.requiredMove))) {
					problems.push(`${template.species} transforms in-battle with ${template.requiredMove}.`); // Meloetta-Pirouette, Rayquaza-Mega
				}
			} else {
				if (template.requiredMove && !set.moves.includes(toId(template.requiredMove))) {
					problems.push(`${(set.name || set.species)} needs to have the move ${template.requiredMove}.`); // Keldeo-Resolute
				}
			}

			if (set.species !== template.species) {
				// Autofixed forme.
				template = this.getTemplate(set.species);
			}

			return problems;
		},
	},
};

exports.BattleFormats = BattleFormats;
