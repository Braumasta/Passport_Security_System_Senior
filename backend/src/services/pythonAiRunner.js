import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const verifierScriptPaths = {
  account: path.resolve(currentDirectory, '..', '..', 'ai', 'account_verification_ai.py'),
  passport: path.resolve(currentDirectory, '..', '..', 'ai', 'passport_application_ai.py'),
};

const parsePythonCommand = (command) => {
  const parts = String(command || 'python')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    executable: parts[0] || 'python',
    args: parts.slice(1),
  };
};

export const runPythonAiVerification = ({ mode, payload }) =>
  new Promise((resolve, reject) => {
    const { executable, args } = parsePythonCommand(env.aiPythonCommand);
    const verifierScriptPath = verifierScriptPaths[mode];

    if (!verifierScriptPath) {
      reject(new Error(`Unsupported Python AI mode: ${mode}`));
      return;
    }

    const child = spawn(executable, [...args, verifierScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Python AI process failed to start: ${error.message}`));
    });

    child.on('close', (exitCode) => {
      let parsedResult;

      try {
        parsedResult = JSON.parse(stdout);
      } catch (error) {
        reject(
          new Error(
            `Python AI returned invalid JSON. Exit code: ${exitCode}. stderr: ${stderr || 'none'}`
          )
        );
        return;
      }

      if (exitCode !== 0 || !parsedResult.ok) {
        reject(new Error(parsedResult.error || stderr || 'Python AI verification failed'));
        return;
      }

      resolve(parsedResult.result);
    });

    child.stdin.write(JSON.stringify({ mode, payload }));
    child.stdin.end();
  });
