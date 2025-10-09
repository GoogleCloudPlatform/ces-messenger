/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { Logger } from '@/logger.js';

class FunctionToolHandler {
  constructor(location, projectId, agentId, sessionId, accessToken, router) {
    this.location = location;
    this.projectId = projectId;
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.accessToken = accessToken;
    this.router = router;
    this.registeredFunctions = [];
    this.functionResponseOk = { status: 'OK' }; //  human_response: 'approve 50% first month' } Example response, adjust as needed.
  }

  #getFunction(toolId) {
    return this.registeredFunctions.find(
      (f) =>
        f.toolId.toolName === toolId.toolName &&
        f.toolId.toolDisplayName === toolId.toolDisplayName
    );
  }

  registerClientSideFunction(toolId, functionRef) {
    this.registeredFunctions.push({
      toolId,
      functionRef,
    });
    Logger.log('Registered function', { toolId, functionRef });
  }

  async runFunctionTool(toolCallId, toolId, toolInput) {
    const registeredFunctionInfo = this.#getFunction(toolId);
    if (registeredFunctionInfo) {
      const functionToCall = registeredFunctionInfo.functionRef;
      try {
        const response = await functionToCall(toolInput, this);
        const toolCallResponse = {
          id: toolCallId,
          tool: registeredFunctionInfo.toolId.toolName,
          // The displayName from the toolCall is what we should return back,
          // not necessarily what was registered.
          displayName: toolId.toolDisplayName,
          response: response,
        };
        return toolCallResponse;
      } catch (e) {
        const toolIdentifier = toolId.toolDisplayName || toolId.toolName;
        Logger.error(
          `An error occurred while running tool '${toolIdentifier}':`,
          e
        );
        return {
          error: `An error occurred while running ${toolIdentifier}. The function returned ${e.message}`,
        };
      }
    }
    Logger.log('Error: could not find registered function', { toolId });
    return {
      error: `Function tool '${
        toolId.toolDisplayName || toolId.toolName
      }' not registered.`,
    };
  }

}

export { FunctionToolHandler };
