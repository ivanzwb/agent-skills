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
    console.log('  install <source>          Install a skill from directory or zip');
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

      case 'install': {
        const source = args[1];
        if (!source) {
          console.error('Error: source is required');
          console.error('Usage: skill install <source>');
          process.exit(1);
        }
        const result = await framework.install(source);
        console.log(`Installed ${result.name}`);
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
        console.log('  install <source>          Install a skill from directory or zip');
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
