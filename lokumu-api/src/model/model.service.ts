import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import { getModelConfig, ModelType } from './model-registry';

@Injectable()
export class ModelService implements OnModuleInit, OnModuleDestroy {
  private llamaProcess: ChildProcessWithoutNullStreams | null;
  private currentModel: ModelType | null = null;
  private readonly LLAMA_BIN = process.env.LLAMA_BIN || join(process.cwd(), 'llama.cpp', 'main');
  private readonly MODEL_DIR = process.env.MODEL_DIR || join(process.cwd(), 'models');

  async onModuleInit() {
    console.log('ModelService initialized. Llama binary expected at:', this.LLAMA_BIN);
  }

  async onModuleDestroy() {
    if (this.llamaProcess) {
      this.llamaProcess.kill();
      this.llamaProcess = null;
    }
  }

  /**
   * Ensure correct model is loaded for the given mode
   */
  private async ensureModel(type: ModelType): Promise<void> {
    if (this.currentModel === type && this.llamaProcess) return;

    // Kill current process if switching models
    if (this.llamaProcess) {
      this.llamaProcess.kill();
      this.llamaProcess = null;
    }

    this.currentModel = type;
  }

  /**
   * Generate text using llama.cpp CLI with mode-based model selection
   */
  async generate(
    prompt: string,
    options: {
      n_predict?: number;
      temperature?: number;
      top_p?: number;
      repeat_penalty?: number;
      modelType?: ModelType;
      model?: string;
    } = {},
  ): Promise<string> {
    const modelType = options.modelType || 'code';
    const modelConfig = options.model ? null : getModelConfig(modelType);
    const modelName = options.model || modelConfig?.defaultName || 'qwen2.5-coder-1.5b-q4_k_m.gguf';

    const {
      n_predict = modelType === 'chat' ? 256 : 128,
      temperature = modelType === 'chat' ? 0.7 : 0.1,
      top_p = 0.95,
      repeat_penalty = 1.1,
    } = options;

    const modelPath = join(this.MODEL_DIR, modelName);

    const args = [
      '-m', modelPath,
      '-p', prompt,
      '-n', n_predict.toString(),
      '--temp', temperature.toString(),
      '--top_p', top_p.toString(),
      '--repeat_penalty', repeat_penalty.toString(),
      '--ctx_size', '2048',
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(this.LLAMA_BIN, args, { stdio: ['pipe', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams;
      let output = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data: string) => {
        output += data;
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data: string) => {
        console.error('llama.cpp stderr:', data);
      });
      child.on('close', (code: number) => {
        if (code !== 0) {
          return reject(new Error(`llama.cpp exited with code ${code}`));
        }
        resolve(output.trim());
      });
      child.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Check if model exists
   */
  async loadModel(modelName: string): Promise<boolean> {
    const modelPath = join(this.MODEL_DIR, modelName);
    try {
      await fs.access(modelPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  getCurrentModel(): ModelType | null {
    return this.currentModel;
  }
}