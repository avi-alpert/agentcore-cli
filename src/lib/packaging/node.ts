import type { AgentEnvSpec, NodeRuntime, RuntimeVersion } from '../../schema';
import { getArtifactZipName } from '../constants';
import { PackagingError } from './errors';
import {
  createZipFromDir,
  createZipFromDirSync,
  enforceZipSizeLimit,
  enforceZipSizeLimitSync,
  ensureDirClean,
  ensureDirCleanSync,
  isNodeRuntime,
  resolveNodeProjectPaths,
  resolveNodeProjectPathsSync,
} from './helpers';
import type { ArtifactResult, CodeZipPackager, PackageOptions, RuntimePackager } from './types/packaging';
import { build, buildSync } from 'esbuild';
import { existsSync } from 'fs';
import { join } from 'path';

const NODE_RUNTIME_REGEX = /NODE_(\d+)/;

/**
 * Type guard to check if runtime version is a Node runtime
 */
function isNodeRuntimeVersion(version: RuntimeVersion): version is NodeRuntime {
  return isNodeRuntime(version);
}

/**
 * Extracts Node version from runtime constant.
 * Example: NODE_20 -> "20" (for use with node version checks)
 */
export function extractNodeVersion(runtime: NodeRuntime): string {
  const match = NODE_RUNTIME_REGEX.exec(runtime);
  if (!match) {
    throw new PackagingError(`Unsupported Node runtime value: ${runtime}`);
  }
  const [, major] = match;
  if (!major) {
    throw new PackagingError(`Invalid Node runtime value: ${runtime}`);
  }
  return major;
}

/**
 * Async Node/TypeScript packager for CLI usage.
 * Bundles TypeScript source into a single JS file using esbuild.
 */
export class NodeCodeZipPackager implements RuntimePackager {
  async pack(spec: AgentEnvSpec, options: PackageOptions = {}): Promise<ArtifactResult> {
    if (spec.build !== 'CodeZip') {
      throw new PackagingError('Node packager only supports CodeZip build type.');
    }

    if (!isNodeRuntimeVersion(spec.runtimeVersion!)) {
      throw new PackagingError(`Node packager only supports Node runtimes. Received: ${spec.runtimeVersion}`);
    }

    const agentName = options.agentName ?? spec.name;
    const { srcDir, stagingDir, artifactsDir } = await resolveNodeProjectPaths(options, agentName);

    await ensureDirClean(stagingDir);

    const entryFile = join(srcDir, 'main.ts');
    const runtimeVersion = spec.runtimeVersion;
    const nodeTarget = `node${extractNodeVersion(runtimeVersion)}`;
    const cjsBanner = `var __import_meta_url = require("url").pathToFileURL(__filename).href;
if (typeof import.meta === "object") Object.defineProperty(import.meta, "url", { value: __import_meta_url });`;
    await build({
      entryPoints: [entryFile],
      outfile: join(stagingDir, 'main.js'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      minify: true,
      target: nodeTarget,
      banner: { js: cjsBanner },
      define: { 'import.meta.url': '__import_meta_url' },
    });

    const otelRegister = join(srcDir, 'otel-register.ts');
    if (existsSync(otelRegister)) {
      await build({
        entryPoints: [otelRegister],
        outfile: join(stagingDir, 'otel-register.js'),
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: nodeTarget,
      });
    }

    const artifactPath = options.outputPath ?? join(artifactsDir, getArtifactZipName(agentName));
    await createZipFromDir(stagingDir, artifactPath);
    const sizeBytes = await enforceZipSizeLimit(artifactPath);

    return {
      artifactPath,
      sizeBytes,
      stagingPath: stagingDir,
    };
  }
}

/**
 * Sync Node/TypeScript packager for CDK bundling.
 * Bundles TypeScript source into a single JS file using esbuild.
 */
export class NodeCodeZipPackagerSync implements CodeZipPackager {
  packCodeZip(config: AgentEnvSpec, options: PackageOptions = {}): ArtifactResult {
    const runtimeVersion = config.runtimeVersion ?? 'NODE_20';

    if (!isNodeRuntimeVersion(runtimeVersion)) {
      throw new PackagingError(`Node packager only supports Node runtimes. Received: ${runtimeVersion}`);
    }

    const agentName = options.agentName ?? config.name ?? 'asset';
    const { srcDir, stagingDir, artifactsDir } = resolveNodeProjectPathsSync(options, agentName);

    ensureDirCleanSync(stagingDir);

    const entryFile = join(srcDir, 'main.ts');
    const nodeTarget = `node${extractNodeVersion(runtimeVersion)}`;
    const cjsBanner = `var __import_meta_url = require("url").pathToFileURL(__filename).href;
if (typeof import.meta === "object") Object.defineProperty(import.meta, "url", { value: __import_meta_url });`;
    buildSync({
      entryPoints: [entryFile],
      outfile: join(stagingDir, 'main.js'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      minify: true,
      target: nodeTarget,
      banner: { js: cjsBanner },
      define: { 'import.meta.url': '__import_meta_url' },
    });

    const otelRegister = join(srcDir, 'otel-register.ts');
    if (existsSync(otelRegister)) {
      buildSync({
        entryPoints: [otelRegister],
        outfile: join(stagingDir, 'otel-register.js'),
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: nodeTarget,
      });
    }

    const artifactPath = options.outputPath ?? join(artifactsDir, getArtifactZipName(agentName));
    createZipFromDirSync(stagingDir, artifactPath);
    const sizeBytes = enforceZipSizeLimitSync(artifactPath);

    return {
      artifactPath,
      sizeBytes,
      stagingPath: stagingDir,
    };
  }
}
