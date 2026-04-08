#!/usr/bin/env node

const { SkillFramework } = require('../dist/index.js');
const path = require('path');
const fs = require('fs');

function getSkillsDir() {
  return process.env.SKILL_HOME || path.join(__dirname, '..', 'skills');
}

function parseGlobalOptions(rawArgs) {
  const options = {
    proxy: undefined,
    httpProxy: undefined,
    httpsProxy: undefined,
    githubApi: undefined,
    githubDownload: undefined,
    clawhubApi: undefined,
  };

  const args = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (!arg.startsWith('--')) {
      args.push(arg);
      continue;
    }

    const [name, inlineValue] = arg.split('=', 2);
    const next = rawArgs[i + 1];
    const hasNextValue = !inlineValue && next && !next.startsWith('--');
    const value = inlineValue || (hasNextValue ? next : undefined);

    let handled = false;

    switch (name) {
      case '--proxy':
        if (value) {
          options.proxy = value;
          handled = true;
        }
        break;
      case '--http-proxy':
        if (value) {
          options.httpProxy = value;
          handled = true;
        }
        break;
      case '--https-proxy':
        if (value) {
          options.httpsProxy = value;
          handled = true;
        }
        break;
      case '--github-api':
        if (value) {
          options.githubApi = value;
          handled = true;
        }
        break;
      case '--github-download':
        if (value) {
          options.githubDownload = value;
          handled = true;
        }
        break;
      case '--clawhub-api':
        if (value) {
          options.clawhubApi = value;
          handled = true;
        }
        break;
      default:
        break;
    }

    if (handled && hasNextValue) {
      i += 1; // skip consumed value
    }

    if (!handled) {
      // keep unknown options as positional arguments so subcommands can use them
      args.push(arg);
    }
  }

  return { options, args };
}

function applyProxyAndMirrorConfig(options) {
  if (options.proxy) {
    process.env.HTTP_PROXY = options.proxy;
    process.env.HTTPS_PROXY = options.proxy;
    process.env.ALL_PROXY = options.proxy;
  }
  if (options.httpProxy) {
    process.env.HTTP_PROXY = options.httpProxy;
  }
  if (options.httpsProxy) {
    process.env.HTTPS_PROXY = options.httpsProxy;
  }

  const mirrorConfig = {};
  if (options.githubApi) {
    mirrorConfig.githubApi = options.githubApi;
  }
  if (options.githubDownload) {
    mirrorConfig.githubDownload = options.githubDownload;
  }
  if (options.clawhubApi) {
    mirrorConfig.clawHubApi = options.clawhubApi;
  }

  if (Object.keys(mirrorConfig).length > 0) {
    SkillFramework.configureMirror(mirrorConfig);
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const { options, args } = parseGlobalOptions(rawArgs);
  const command = args[0];

  applyProxyAndMirrorConfig(options);

  const framework = new SkillFramework(getSkillsDir());

  if (!command) {
    console.log('Usage: skill <command> [options]');
    console.log('');
    console.log('Global options (must come before command):');
    console.log('  --proxy <url>               Set HTTP(S) proxy env for downloads');
    console.log('  --http-proxy <url>          Set HTTP_PROXY for child processes');
    console.log('  --https-proxy <url>         Set HTTPS_PROXY for child processes');
    console.log('  --github-api <url>          Override GitHub API base (SKILL_GITHUB_API)');
    console.log('  --github-download <url>     Override GitHub download base (SKILL_GITHUB_DOWNLOAD)');
    console.log('  --clawhub-api <url>         Override ClawHub API base (SKILL_CLAWHUB_API)');
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

        const resolvedPath = path.resolve(source);
        const looksLikePath =
          path.isAbsolute(source) ||
          source.startsWith('.') ||
          source.includes(path.sep) ||
          source.endsWith('.zip');

        if (looksLikePath && fs.existsSync(resolvedPath)) {
          // Treat as local directory/zip
          result = await framework.install(resolvedPath);
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

        const resolvedPath = path.resolve(source);
        const looksLikePath =
          path.isAbsolute(source) ||
          source.startsWith('.') ||
          source.includes(path.sep) ||
          source.endsWith('.zip');

        if (looksLikePath && fs.existsSync(resolvedPath)) {
          preview = framework.previewSkill(resolvedPath);
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
        console.log('Global options (must come before command):');
        console.log('  --proxy <url>               Set HTTP(S) proxy env for downloads');
        console.log('  --http-proxy <url>          Set HTTP_PROXY for child processes');
        console.log('  --https-proxy <url>         Set HTTPS_PROXY for child processes');
        console.log('  --github-api <url>          Override GitHub API base (SKILL_GITHUB_API)');
        console.log('  --github-download <url>     Override GitHub download base (SKILL_GITHUB_DOWNLOAD)');
        console.log('  --clawhub-api <url>         Override ClawHub API base (SKILL_CLAWHUB_API)');
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
