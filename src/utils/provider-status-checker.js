const { Anthropic, APIConnectionTimeoutError, APIConnectionError, APIError } = require('@anthropic-ai/sdk');

class ProviderStatusChecker {
  constructor(options = {}) {
    this.timeout = options.timeout ?? 5000;
    this.testMessage = options.testMessage ?? '你好';
    this.maxTokens = options.maxTokens ?? 32;
    this.defaultModel = 'claude-haiku-4-5-20251001';
    this.env = options.env ?? process.env;
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 4);
  }

  async check(provider) {
    if (!provider) {
      return this._result('unknown', '未找到配置', null);
    }

    if (provider.authMode === 'oauth_token') {
      return this._result('unknown', '暂不支持 OAuth 令牌检测', null);
    }

    if (!provider.baseUrl) {
      return this._result('unknown', '未配置基础地址', null);
    }

    if (!provider.authToken) {
      return this._result('unknown', '未配置认证信息', null);
    }

    const model = this._resolveModel(provider);
    try {
      const client = this._createClient(provider);
      if (!client) {
        return this._result('unknown', '认证模式不受支持', null);
      }

      const start = process.hrtime.bigint();
      const response = await client.messages.create({
        model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: this.testMessage
          }
        ]
      }, { timeout: this.timeout });
      const latency = Number(process.hrtime.bigint() - start) / 1e6;

      const text = this._extractText(response);
      if (!text) {
        return this._result('online', `可用 ${latency.toFixed(0)}ms (无文本响应)`, latency);
      }

      return this._result('online', `可用 ${latency.toFixed(0)}ms`, latency);
    } catch (error) {
      return this._handleError(error);
    }
  }

  async checkAll(providers) {
    const entries = await Promise.all(
      providers.map(async provider => {
        const status = await this.check(provider);
        return [provider.name, status];
      })
    );
    return Object.fromEntries(entries);
  }

  checkAllStreaming(providers, onUpdate) {
    const results = {};
    let nextIndex = 0;

    const runNext = async () => {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= providers.length) {
        return;
      }

      const provider = providers[currentIndex];
      try {
        const status = await this.check(provider);
        results[provider.name] = status;
        if (typeof onUpdate === 'function') {
          onUpdate(provider.name, status, null);
        }
      } catch (error) {
        const fallback = this._result('offline', `检测失败: ${error.message}`, null);
        results[provider.name] = fallback;
        if (typeof onUpdate === 'function') {
          onUpdate(provider.name, fallback, error);
        }
      }

      await runNext();
    };

    const workerCount = Math.min(this.maxConcurrency, providers.length);
    const workers = Array.from({ length: workerCount }, () => runNext());

    return Promise.all(workers).then(() => results);
  }

  _createClient(provider) {
    const clientOptions = { baseURL: provider.baseUrl };

    if (provider.authMode === 'api_key') {
      clientOptions.apiKey = provider.authToken;
    } else if (provider.authMode === 'auth_token') {
      clientOptions.authToken = provider.authToken;
    } else {
      return null;
    }

    return new Anthropic(clientOptions);
  }

  _resolveModel(provider) {
    const haikuModel = this._resolveConfiguredModel(provider, 'haiku', 'ANTHROPIC_DEFAULT_HAIKU_MODEL');
    if (haikuModel) {
      return haikuModel;
    }

    const sonnetModel = this._resolveConfiguredModel(provider, 'sonnet', 'ANTHROPIC_DEFAULT_SONNET_MODEL');
    if (sonnetModel) {
      return sonnetModel;
    }

    const opusModel = this._resolveConfiguredModel(provider, 'opus', 'ANTHROPIC_DEFAULT_OPUS_MODEL');
    if (opusModel) {
      return opusModel;
    }

    return this.defaultModel;
  }

  _resolveConfiguredModel(provider, modelKey, envKey) {
    const providerModel = this._normalizeModelName(provider.models?.[modelKey]);
    if (providerModel) {
      return providerModel;
    }

    return this._normalizeModelName(this.env?.[envKey]);
  }

  _normalizeModelName(modelName) {
    if (typeof modelName !== 'string') {
      return null;
    }

    const trimmed = modelName.trim();
    return trimmed || null;
  }

  _extractText(response) {
    if (!response) {
      return '';
    }

    // 兼容部分供应商返回字符串内容
    if (typeof response.content === 'string') {
      return response.content.trim();
    }

    if (Array.isArray(response.content)) {
      const textParts = [];
      for (const block of response.content) {
        if (!block) {
          continue;
        }
        if (typeof block === 'string') {
          textParts.push(block);
          continue;
        }
        if (typeof block.text === 'string' && block.text.trim()) {
          textParts.push(block.text);
          continue;
        }
        if (typeof block.thinking === 'string' && block.thinking.trim()) {
          textParts.push(block.thinking);
          continue;
        }
        if (typeof block.output_text === 'string' && block.output_text.trim()) {
          textParts.push(block.output_text);
          continue;
        }
        if (typeof block.argument === 'string' && block.argument.trim()) {
          textParts.push(block.argument);
          continue;
        }
        if (typeof block.result === 'string' && block.result.trim()) {
          textParts.push(block.result);
          continue;
        }
      }
      const combined = textParts
        .map(part => part.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
      if (combined) {
        return combined;
      }
    }

    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    if (typeof response.completion === 'string' && response.completion.trim()) {
      return response.completion.trim();
    }

    return '';
  }


  _handleError(error) {
    if (error instanceof APIConnectionTimeoutError) {
      return this._result('offline', '请求超时', null);
    }

    if (error instanceof APIConnectionError) {
      return this._result('offline', '网络连接失败', null);
    }

    if (error instanceof APIError) {
      if (error.status >= 500) {
        return this._result('degraded', `服务异常 (${error.status})`, null);
      }
      if (error.status === 401 || error.status === 403) {
        return this._result('offline', `认证失败 (${error.status})`, null);
      }
      if (error.status === 404) {
        return this._result('offline', '接口不存在 (404)', null);
      }
      return this._result('offline', `请求失败 (${error.status})`, null);
    }

    if (error?.name === 'AbortError') {
      return this._result('offline', '请求超时', null);
    }

    return this._result('offline', `检测失败: ${error?.message || '未知错误'}`, null);
  }

  _result(state, label, latency) {
    return { state, label, latency };
  }
}

module.exports = { ProviderStatusChecker };
