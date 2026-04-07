#!/usr/bin/env node

const { SkillFramework } = require('../dist/index.js');
const path = require('path');

function getSkillsDir() {
  return process.env.SKILL_HOME || path.join(__dirname, '..', 'skills');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const framework = new SkillFramework(getSkillsDir());

  if (!command) {
    console.log('Usage: skill <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  list                      List all installed skills');
    console.log('  find <query>              Search for skills from all sources');
    console.log('  install <source>          Install a skill from directory, zip, GitHub, or ClawHub');
    console.log('  preview <source>          Preview a skill before installing');
    console.log('  uninstall <name>          Uninstall a skill');
    console.log('  run <skill> <tool> [args] Run a skill tool');
    console.log('  help                      Show this help message');
    process.exit(0);
  }

  try {
    switch (command) {
      case 'list': {
        const result = framework.listSkills();
        if (result.skills.length === 0) {
          console.log('No skills installed.');
        } else {
          console.log('Installed skills:');
          for (const skill of result.skills) {
            console.log(`  ${skill.name} - ${skill.description}`);
          }
        }
        break;
      }

      case 'find': {
        const query = args[1];
        if (!query) {
          console.error('Error: query is required');
          console.error('Usage: skill find <query>');
          process.exit(1);
        }
        const results = await SkillFramework.searchSkills(query);
        if (results.length === 0) {
          console.log('No skills found.');
        } else {
          console.log('Found skills:');
          for (const r of results) {
            if (r.source === 'clawhub') {
              console.log(`  [ClawHub] ${r.slug} - ${r.description}`);
              console.log(`    Install: skill install ${r.slug}`);
            } else {
              console.log(`  [GitHub] ${r.owner}/${r.repo} - ${r.description}`);
              console.log(`    Install: skill install ${r.owner}/${r.repo}`);
            }
          }
        }
        break;
      }

      case 'install': {
        const source = args[1];
        if (!source) {
          console.error('Error: source is required');
          console.error('Usage: skill install <source>');
          process.exit(1);
        }
        let result;
        if (source.includes('/')) {
          result = await framework.installFromNetwork(source);
        } else {
          const localCheck = framework.listSkills().skills.find(s => s.name === source);
          if (localCheck) {
            result = await framework.install(source);
          } else {
            result = await framework.installFromNetwork(source);
          }
        }
        console.log(`Installed ${result.name}`);
        break;
      }

      case 'preview': {
        const source = args[1];
        if (!source) {
          console.error('Error: source is required');
          console.error('Usage: skill preview <source>');
          process.exit(1);
        }
        let preview;
        if (source.includes('/')) {
          preview = await framework.previewSkillFromNetwork(source);
        } else {
          const localCheck = framework.listSkills().skills.find(s => s.name === source);
          if (localCheck) {
            preview = framework.previewSkill(source);
          } else {
            preview = await framework.previewSkillFromNetwork(source);
          }
        }
        console.log(`Name: ${preview.name}`);
        console.log(`Description: ${preview.description}`);
        if (preview.license) console.log(`License: ${preview.license}`);
        if (preview.compatibility) console.log(`Compatibility: ${preview.compatibility}`);
        if (preview.tools.length > 0) {
          console.log('Tools:');
          for (const t of preview.tools) {
            console.log(`  ${t.name} - ${t.description}`);
          }
        }
        console.log(`\nTo install: skill install ${source}`);
        break;
      }

      case 'uninstall': {
        const name = args[1];
        if (!name) {
          console.error('Error: skill name is required');
          console.error('Usage: skill uninstall <name>');
          process.exit(1);
        }
        await framework.uninstall(name);
        console.log(`Uninstalled ${name}`);
        break;
      }

      case 'run': {
        const skillName = args[1];
        const toolName = args[2];
        let argsJson = '{}';

        if (!skillName || !toolName) {
          console.error('Error: skill and tool name are required');
          console.error('Usage: skill run <skill> <tool> [args-json]');
          process.exit(1);
        }

        if (args[3]) {
          argsJson = args[3];
        }

        const result = await framework.runScript({
          name: skillName,
          toolName,
          args: argsJson,
        });

        if (result.exitCode === 0) {
          console.log(result.stdout);
        } else {
          console.error(result.stderr);
          process.exit(result.exitCode);
        }
        break;
      }

      case 'help': {
        console.log('Usage: skill <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  list                      List all installed skills');
        console.log('  find <query>              Search for skills from the network (GitHub)');
        console.log('  clawhub <query>           Search for skills from ClawHub registry');
        console.log('  install <source>          Install a skill from directory, zip, GitHub, or ClawHub');
        console.log('  preview <source>         Preview a skill before installing');
        console.log('  uninstall <name>          Uninstall a skill');
        console.log('  run <skill> <tool> [args] Run a skill tool');
        console.log('  help                      Show this help message');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "skill help" for usage.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
