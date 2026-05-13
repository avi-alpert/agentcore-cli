import { APP_DIR } from '../../lib';
import { copyAndRenderDir, copyDir } from './render';
import type { AgentRenderConfig } from './types';
import Handlebars from 'handlebars';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface RendererContext {
  outputDir: string;
}

type TemplateData = AgentRenderConfig &
  RendererContext & {
    projectName: string;
    Name: string;
    hasMcp: boolean;
  };

export abstract class BaseRenderer {
  protected readonly config: AgentRenderConfig;
  protected readonly sdkName: string;
  protected readonly baseTemplateDir: string;
  protected readonly protocolMode: string;

  protected constructor(config: AgentRenderConfig, sdkName: string, baseTemplateDir: string, protocolMode?: string) {
    this.config = config;
    this.sdkName = sdkName;
    this.baseTemplateDir = baseTemplateDir;
    this.protocolMode = (protocolMode ?? config.protocol ?? 'HTTP').toLowerCase();
  }

  protected shouldRenderMemory(): boolean {
    return this.config.hasMemory;
  }

  protected getTemplateDir(): string {
    const language = this.config.targetLanguage.toLowerCase();
    return path.join(this.baseTemplateDir, language, this.protocolMode, this.sdkName);
  }

  async render(context: RendererContext): Promise<void> {
    const templateDir = this.getTemplateDir();
    const projectName = this.config.name;
    // Agents are placed in app/<agentName>/ directory
    const projectDir = path.join(context.outputDir, APP_DIR, projectName);

    const templateData: TemplateData = {
      ...this.config,
      ...context,
      projectName,
      Name: projectName,
      hasMcp: false, // MCP is configured separately
    };

    // Always render base template
    const baseDir = path.join(templateDir, 'base');
    await copyAndRenderDir(baseDir, projectDir, templateData);

    // Render capability templates based on config
    // Only render if the capability directory exists (not all SDKs have all capabilities)
    if (this.shouldRenderMemory()) {
      const memoryCapabilityDir = path.join(templateDir, 'capabilities', 'memory');
      if (existsSync(memoryCapabilityDir)) {
        const memoryTargetDir = path.join(projectDir, 'memory');
        await copyAndRenderDir(memoryCapabilityDir, memoryTargetDir, templateData);
      }
    }

    // Render CopilotKit frontend (AGUI with frontend enabled)
    // Uses plain copy (not Handlebars) because TSX files contain {{ in JSX syntax.
    // Only package.json and index.html need template substitution.
    if (this.config.hasFrontend) {
      const frontendTemplateDir = path.join(this.baseTemplateDir, 'frontend', 'copilotkit');
      if (existsSync(frontendTemplateDir)) {
        const frontendTargetDir = path.join(projectDir, 'frontend');
        await copyDir(frontendTemplateDir, frontendTargetDir);
        // Render Handlebars in the files that need variable substitution
        for (const file of ['package.json', 'index.html']) {
          const filePath = path.join(frontendTargetDir, file);
          if (existsSync(filePath)) {
            const content = await fs.readFile(filePath, 'utf-8');
            const rendered = Handlebars.compile(content)(templateData);
            await fs.writeFile(filePath, rendered, 'utf-8');
          }
        }
      }
    }

    // Generate Dockerfile and .dockerignore for Container builds
    if (this.config.buildType === 'Container') {
      const language = this.config.targetLanguage.toLowerCase();
      const containerTemplateDir = path.join(this.baseTemplateDir, 'container', language);

      if (existsSync(containerTemplateDir)) {
        const exclude = this.config.dockerfile ? new Set(['Dockerfile']) : undefined;
        await copyAndRenderDir(
          containerTemplateDir,
          projectDir,
          { ...templateData, entrypoint: 'main', enableOtel: this.config.enableOtel ?? true },
          { exclude }
        );
      }
    }
  }
}
