(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function debounce(func, debounceMs, { signal, edges } = {}) {
  let pendingThis = void 0;
  let pendingArgs = null;
  const leading = edges != null && edges.includes("leading");
  const trailing = edges == null || edges.includes("trailing");
  const invoke = () => {
    if (pendingArgs !== null) {
      func.apply(pendingThis, pendingArgs);
      pendingThis = void 0;
      pendingArgs = null;
    }
  };
  const onTimerEnd = () => {
    if (trailing) {
      invoke();
    }
    cancel();
  };
  let timeoutId = null;
  const schedule = () => {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      onTimerEnd();
    }, debounceMs);
  };
  const cancelTimer = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  const cancel = () => {
    cancelTimer();
    pendingThis = void 0;
    pendingArgs = null;
  };
  const flush = () => {
    invoke();
  };
  const debounced = function(...args) {
    if (signal?.aborted) {
      return;
    }
    pendingThis = this;
    pendingArgs = args;
    const isFirstCall = timeoutId == null;
    schedule();
    if (leading && isFirstCall) {
      invoke();
    }
  };
  debounced.schedule = schedule;
  debounced.cancel = cancel;
  debounced.flush = flush;
  signal?.addEventListener("abort", cancel, { once: true });
  return debounced;
}
/* @license twgl.js 7.0.0 Copyright (c) 2015, Gregg Tavares All Rights Reserved.
Available via the MIT license.
see: http://github.com/greggman/twgl.js for details */
function error$1(...args) {
  console.error(...args);
}
const isTypeWeakMaps = /* @__PURE__ */ new Map();
function isType(object, type) {
  if (!object || typeof object !== "object") {
    return false;
  }
  let weakMap = isTypeWeakMaps.get(type);
  if (!weakMap) {
    weakMap = /* @__PURE__ */ new WeakMap();
    isTypeWeakMaps.set(type, weakMap);
  }
  let isOfType = weakMap.get(object);
  if (isOfType === void 0) {
    const s = Object.prototype.toString.call(object);
    isOfType = s.substring(8, s.length - 1) === type;
    weakMap.set(object, isOfType);
  }
  return isOfType;
}
function isBuffer(gl, t) {
  return typeof WebGLBuffer !== "undefined" && isType(t, "WebGLBuffer");
}
const STATIC_DRAW = 35044;
const ARRAY_BUFFER$1 = 34962;
function setBufferFromTypedArray(gl, type, buffer, array, drawType) {
  gl.bindBuffer(type, buffer);
  gl.bufferData(type, array, drawType || STATIC_DRAW);
}
function createBufferFromTypedArray(gl, typedArray, type, drawType) {
  if (isBuffer(gl, typedArray)) {
    return typedArray;
  }
  type = type || ARRAY_BUFFER$1;
  const buffer = gl.createBuffer();
  setBufferFromTypedArray(gl, type, buffer, typedArray, drawType);
  return buffer;
}
const glEnumToString = /* @__PURE__ */ function() {
  const haveEnumsForType = {};
  const enums = {};
  function addEnums(gl) {
    const type = gl.constructor.name;
    if (!haveEnumsForType[type]) {
      for (const key in gl) {
        if (typeof gl[key] === "number") {
          const existing = enums[gl[key]];
          enums[gl[key]] = existing ? `${existing} | ${key}` : key;
        }
      }
      haveEnumsForType[type] = true;
    }
  }
  return function glEnumToString2(gl, value) {
    addEnums(gl);
    return enums[value] || (typeof value === "number" ? `0x${value.toString(16)}` : value);
  };
}();
const error = error$1;
function getElementById(id) {
  return typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null;
}
const COMPILE_STATUS = 35713;
const LINK_STATUS = 35714;
const FRAGMENT_SHADER = 35632;
const VERTEX_SHADER = 35633;
const SEPARATE_ATTRIBS = 35981;
const errorRE = /ERROR:\s*\d+:(\d+)/gi;
function addLineNumbersWithError(src, log = "", lineOffset = 0) {
  const matches = [...log.matchAll(errorRE)];
  const lineNoToErrorMap = new Map(matches.map((m, ndx) => {
    const lineNo = parseInt(m[1]);
    const next = matches[ndx + 1];
    const end = next ? next.index : log.length;
    const msg = log.substring(m.index, end);
    return [lineNo - 1, msg];
  }));
  return src.split("\n").map((line, lineNo) => {
    const err = lineNoToErrorMap.get(lineNo);
    return `${lineNo + 1 + lineOffset}: ${line}${err ? `

^^^ ${err}` : ""}`;
  }).join("\n");
}
const spaceRE = /^[ \t]*\n/;
function prepShaderSource(shaderSource) {
  let lineOffset = 0;
  if (spaceRE.test(shaderSource)) {
    lineOffset = 1;
    shaderSource = shaderSource.replace(spaceRE, "");
  }
  return { lineOffset, shaderSource };
}
function checkShaderStatus(gl, shaderType, shader, errFn) {
  errFn = errFn || error;
  const compiled = gl.getShaderParameter(shader, COMPILE_STATUS);
  if (!compiled) {
    const lastError = gl.getShaderInfoLog(shader);
    const { lineOffset, shaderSource } = prepShaderSource(gl.getShaderSource(shader));
    const error2 = `${addLineNumbersWithError(shaderSource, lastError, lineOffset)}
Error compiling ${glEnumToString(gl, shaderType)}: ${lastError}`;
    errFn(error2);
    return error2;
  }
  return "";
}
function getProgramOptions(opt_attribs, opt_locations, opt_errorCallback) {
  let transformFeedbackVaryings;
  let transformFeedbackMode;
  let callback;
  if (typeof opt_locations === "function") {
    opt_errorCallback = opt_locations;
    opt_locations = void 0;
  }
  if (typeof opt_attribs === "function") {
    opt_errorCallback = opt_attribs;
    opt_attribs = void 0;
  } else if (opt_attribs && !Array.isArray(opt_attribs)) {
    const opt = opt_attribs;
    opt_errorCallback = opt.errorCallback;
    opt_attribs = opt.attribLocations;
    transformFeedbackVaryings = opt.transformFeedbackVaryings;
    transformFeedbackMode = opt.transformFeedbackMode;
    callback = opt.callback;
  }
  const errorCallback = opt_errorCallback || error;
  const errors = [];
  const options = {
    errorCallback(msg, ...args) {
      errors.push(msg);
      errorCallback(msg, ...args);
    },
    transformFeedbackVaryings,
    transformFeedbackMode,
    callback,
    errors
  };
  {
    let attribLocations = {};
    if (Array.isArray(opt_attribs)) {
      opt_attribs.forEach(function(attrib, ndx) {
        attribLocations[attrib] = opt_locations ? opt_locations[ndx] : ndx;
      });
    } else {
      attribLocations = opt_attribs || {};
    }
    options.attribLocations = attribLocations;
  }
  return options;
}
const defaultShaderType = [
  "VERTEX_SHADER",
  "FRAGMENT_SHADER"
];
function getShaderTypeFromScriptType(gl, scriptType) {
  if (scriptType.indexOf("frag") >= 0) {
    return FRAGMENT_SHADER;
  } else if (scriptType.indexOf("vert") >= 0) {
    return VERTEX_SHADER;
  }
  return void 0;
}
function deleteProgramAndShaders(gl, program, notThese) {
  const shaders = gl.getAttachedShaders(program);
  for (const shader of shaders) {
    if (!notThese.has(shader)) {
      gl.deleteShader(shader);
    }
  }
  gl.deleteProgram(program);
}
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
function createProgramNoCheck(gl, shaders, programOptions) {
  const program = gl.createProgram();
  const {
    attribLocations,
    transformFeedbackVaryings,
    transformFeedbackMode
  } = getProgramOptions(programOptions);
  for (let ndx = 0; ndx < shaders.length; ++ndx) {
    let shader = shaders[ndx];
    if (typeof shader === "string") {
      const elem = getElementById(shader);
      const src = elem ? elem.text : shader;
      let type = gl[defaultShaderType[ndx]];
      if (elem && elem.type) {
        type = getShaderTypeFromScriptType(gl, elem.type) || type;
      }
      shader = gl.createShader(type);
      gl.shaderSource(shader, prepShaderSource(src).shaderSource);
      gl.compileShader(shader);
    }
    gl.attachShader(program, shader);
  }
  Object.entries(attribLocations).forEach(([attrib, loc]) => gl.bindAttribLocation(program, loc, attrib));
  {
    let varyings = transformFeedbackVaryings;
    if (varyings) {
      if (varyings.attribs) {
        varyings = varyings.attribs;
      }
      if (!Array.isArray(varyings)) {
        varyings = Object.keys(varyings);
      }
      gl.transformFeedbackVaryings(program, varyings, transformFeedbackMode || SEPARATE_ATTRIBS);
    }
  }
  gl.linkProgram(program);
  return program;
}
function createProgram(gl, shaders, opt_attribs, opt_locations, opt_errorCallback) {
  const progOptions = getProgramOptions(opt_attribs, opt_locations, opt_errorCallback);
  const shaderSet = new Set(shaders);
  const program = createProgramNoCheck(gl, shaders, progOptions);
  function hasErrors(gl2, program2) {
    const errors = getProgramErrors(gl2, program2, progOptions.errorCallback);
    if (errors) {
      deleteProgramAndShaders(gl2, program2, shaderSet);
    }
    return errors;
  }
  if (progOptions.callback) {
    waitForProgramLinkCompletionAsync(gl, program).then(() => {
      const errors = hasErrors(gl, program);
      progOptions.callback(errors, errors ? void 0 : program);
    });
    return void 0;
  }
  return hasErrors(gl, program) ? void 0 : program;
}
async function waitForProgramLinkCompletionAsync(gl, program) {
  const ext = gl.getExtension("KHR_parallel_shader_compile");
  const checkFn = ext ? (gl2, program2) => gl2.getProgramParameter(program2, ext.COMPLETION_STATUS_KHR) : () => true;
  let waitTime = 0;
  do {
    await wait(waitTime);
    waitTime = 1e3 / 60;
  } while (!checkFn(gl, program));
}
function getProgramErrors(gl, program, errFn) {
  errFn = errFn || error;
  const linked = gl.getProgramParameter(program, LINK_STATUS);
  if (!linked) {
    const lastError = gl.getProgramInfoLog(program);
    errFn(`Error in program linking: ${lastError}`);
    const shaders = gl.getAttachedShaders(program);
    const errors = shaders.map((shader) => checkShaderStatus(gl, gl.getShaderParameter(shader, gl.SHADER_TYPE), shader, errFn));
    return `${lastError}
${errors.filter((_) => _).join("\n")}`;
  }
  return void 0;
}
const isWorker = typeof importScripts !== "undefined";
const colorToRGBA = /* @__PURE__ */ (() => {
  let init = false;
  let canvas;
  let ctx;
  const map = {};
  return (colorStr) => {
    if (!init) {
      canvas = isWorker ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
      canvas.width = canvas.height = 1;
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      init = true;
    }
    if (!map[colorStr]) {
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      map[colorStr] = [r, g, b, a];
    }
    return map[colorStr];
  };
})();
function withResolvers() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const glsl_pack = `
vec4 packNormalizeFloatToRGBA( in float v ) {
    vec4 enc = vec4(v, fract(vec3(255.0, 65025.0, 16581375.0) * v));
    enc.xyz -= enc.yzw / 255.0; 
    return enc;
}
float unpackRGBAToNormalizeFloat( const in vec4 v ) {
    return dot(v, vec4(1, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}
vec3 packNormalizeFloatToRGB( in float v ) {
	return packNormalizeFloatToRGBA( v ).xyz;
}
float unpackRGBToNormalizeFloat( const in vec3 v ) {
	return unpackRGBAToNormalizeFloat( vec4( v, 0 ) );
}
`;
const position = [{ "x": 117.22936, "y": 28.103932, "ID": "3827" }, { "x": 117.783636, "y": 28.103932, "ID": "3828" }, { "x": 118.337912, "y": 28.103932, "ID": "3829" }, { "x": 118.892188, "y": 28.103932, "ID": "3830" }, { "x": 117.22936, "y": 27.65427, "ID": "3895" }, { "x": 117.783636, "y": 27.65427, "ID": "3896" }, { "x": 118.337912, "y": 27.65427, "ID": "3897" }, { "x": 118.892188, "y": 27.65427, "ID": "3898" }, { "x": 119.446464, "y": 27.65427, "ID": "3899" }, { "x": 116.675084, "y": 27.204607, "ID": "3941" }, { "x": 117.22936, "y": 27.204607, "ID": "3942" }, { "x": 117.783636, "y": 27.204607, "ID": "3943" }, { "x": 118.337912, "y": 27.204607, "ID": "3944" }, { "x": 118.892188, "y": 27.204607, "ID": "3945" }, { "x": 116.675084, "y": 26.754944, "ID": "3994" }, { "x": 117.22936, "y": 26.754944, "ID": "3995" }, { "x": 117.783636, "y": 26.754944, "ID": "3996" }, { "x": 118.337912, "y": 26.754944, "ID": "3997" }, { "x": 118.892188, "y": 26.754944, "ID": "3998" }, { "x": 116.120808, "y": 26.305281, "ID": "4042" }, { "x": 116.675084, "y": 26.305281, "ID": "4043" }, { "x": 117.22936, "y": 26.305281, "ID": "4044" }, { "x": 117.783636, "y": 26.305281, "ID": "4045" }, { "x": 118.337912, "y": 26.305281, "ID": "4046" }, { "x": 118.892188, "y": 26.305281, "ID": "4047" }, { "x": 116.675084, "y": 25.855618, "ID": "4090" }, { "x": 117.22936, "y": 25.855618, "ID": "4091" }, { "x": 117.783636, "y": 25.855618, "ID": "4092" }, { "x": 118.337912, "y": 25.855618, "ID": "4093" }, { "x": 116.675084, "y": 25.405955, "ID": "4130" }, { "x": 117.22936, "y": 25.405955, "ID": "4131" }, { "x": 117.783636, "y": 25.405955, "ID": "4132" }, { "x": 118.337912, "y": 25.405955, "ID": "4133" }];
const timeList$1 = ["2020-05-03 11:00:00", "2020-05-03 14:00:00", "2020-05-03 17:00:00", "2020-05-03 20:00:00", "2020-05-03 23:00:00", "2020-05-04 02:00:00", "2020-05-04 05:00:00", "2020-05-04 08:00:00", "2020-05-04 11:00:00", "2020-05-04 14:00:00", "2020-05-04 17:00:00", "2020-05-04 20:00:00", "2020-05-04 23:00:00", "2020-05-05 02:00:00", "2020-05-05 05:00:00", "2020-05-05 08:00:00", "2020-05-05 11:00:00", "2020-05-05 14:00:00", "2020-05-05 17:00:00", "2020-05-05 20:00:00", "2020-05-05 23:00:00", "2020-05-06 02:00:00", "2020-05-06 05:00:00", "2020-05-06 08:00:00", "2020-05-06 11:00:00", "2020-05-06 14:00:00", "2020-05-06 20:00:00", "2020-05-06 23:00:00", "2020-05-07 02:00:00", "2020-05-07 05:00:00", "2020-05-07 08:00:00", "2020-05-07 11:00:00", "2020-05-07 14:00:00", "2020-05-07 17:00:00", "2020-05-07 20:00:00", "2020-05-07 23:00:00", "2020-05-08 02:00:00", "2020-05-08 05:00:00", "2020-05-08 08:00:00", "2020-05-08 11:00:00", "2020-05-08 14:00:00", "2020-05-08 17:00:00", "2020-05-08 20:00:00", "2020-05-08 23:00:00", "2020-05-09 02:00:00", "2020-05-09 05:00:00", "2020-05-09 08:00:00", "2020-05-09 11:00:00", "2020-05-09 14:00:00", "2020-05-09 17:00:00", "2020-05-09 20:00:00", "2020-05-09 23:00:00", "2020-05-10 02:00:00", "2020-05-10 05:00:00", "2020-05-10 08:00:00", "2020-05-10 11:00:00", "2020-05-10 14:00:00", "2020-05-10 17:00:00", "2020-05-10 20:00:00", "2020-05-10 23:00:00", "2020-05-11 02:00:00", "2020-05-11 05:00:00", "2020-05-11 08:00:00", "2020-05-11 11:00:00", "2020-05-11 14:00:00", "2020-05-11 17:00:00", "2020-05-11 20:00:00", "2020-05-11 23:00:00", "2020-05-12 02:00:00", "2020-05-12 05:00:00", "2020-05-12 08:00:00", "2020-05-12 11:00:00", "2020-05-12 14:00:00", "2020-05-12 17:00:00", "2020-05-12 20:00:00", "2020-05-12 23:00:00", "2020-05-13 02:00:00", "2020-05-13 05:00:00", "2020-05-13 08:00:00", "2020-05-13 11:00:00", "2020-05-13 14:00:00", "2020-05-13 17:00:00", "2020-05-13 20:00:00", "2020-05-13 23:00:00", "2020-05-14 02:00:00", "2020-05-14 05:00:00", "2020-05-14 08:00:00", "2020-05-14 11:00:00", "2020-05-14 14:00:00", "2020-05-14 17:00:00", "2020-05-14 20:00:00", "2020-05-14 23:00:00", "2020-05-15 02:00:00", "2020-05-15 05:00:00", "2020-05-15 08:00:00", "2020-05-15 11:00:00", "2020-05-15 14:00:00", "2020-05-15 17:00:00", "2020-05-15 20:00:00", "2020-05-15 23:00:00", "2020-05-16 02:00:00", "2020-05-16 05:00:00", "2020-05-16 08:00:00", "2020-05-16 11:00:00", "2020-05-16 14:00:00", "2020-05-16 17:00:00", "2020-05-16 20:00:00", "2020-05-16 23:00:00", "2020-05-17 02:00:00", "2020-05-17 05:00:00", "2020-05-17 11:00:00", "2020-05-17 14:00:00"];
const data$1 = [[0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 2, 2, 0, 1, 2, 2, 1, 0, 1, 1, 2, 3, 2, 0, 0, 1, 1, 2, 0, 2, 2, 1, 0], [0, 1, 1, 2, 1, 3, 0, 4, 4, 1, 6, 2, 0, 1, 4, 4, 1, 0, 0, 2, 7, 5, 2, 0, 0, 5, 5, 0, 3, 6, 3, 6, 0], [1, 1, 0, 3, 3, 1, 0, 0, 0, 40, 27, 2, 0, 6, 73, 23, 4, 0, 0, 7, 18, 69, 4, 0, 0, 19, 15, 13, 3, 6, 5, 4, 0], [14, 4, 2, 0, 18, 21, 6, 0, 0, 55, 31, 15, 3, 1, 44, 26, 13, 3, 0, 21, 30, 27, 31, 2, 0, 18, 18, 7, 0, 0, 2, 0, 0], [48, 19, 16, 1, 16, 20, 10, 13, 7, 55, 37, 13, 2, 1, 110, 36, 7, 2, 5, 54, 69, 24, 18, 14, 2, 80, 18, 4, 2, 36, 27, 5, 0], [32, 20, 19, 12, 15, 10, 4, 12, 6, 10, 18, 6, 2, 3, 79, 43, 31, 8, 3, 24, 36, 38, 24, 15, 11, 24, 19, 18, 5, 8, 7, 3, 0], [5, 35, 23, 20, 34, 31, 34, 8, 4, 4, 26, 23, 10, 3, 40, 19, 29, 22, 14, 37, 44, 15, 17, 23, 4, 43, 22, 8, 2, 28, 8, 2, 0], [15, 10, 15, 39, 133, 51, 31, 25, 21, 5, 14, 9, 9, 10, 7, 15, 8, 8, 13, 6, 67, 33, 16, 12, 8, 28, 28, 12, 7, 8, 5, 1, 1], [4, 9, 17, 26, 7, 23, 28, 26, 20, 1, 19, 34, 12, 4, 2, 21, 17, 5, 3, 3, 5, 2, 8, 3, 7, 10, 1, 1, 1, 7, 2, 2, 1], [36, 2, 12, 21, 1, 16, 12, 11, 17, 3, 31, 12, 4, 5, 1, 8, 5, 1, 1, 2, 1, 7, 22, 1, 1, 5, 37, 2, 2, 5, 1, 1, 2], [30, 27, 5, 1, 3, 3, 3, 1, 3, 128, 17, 6, 2, 1, 42, 61, 20, 1, 3, 86, 18, 3, 2, 7, 1, 2, 1, 1, 9, 3, 1, 1, 1], [30, 19, 17, 33, 28, 22, 6, 3, 3, 93, 43, 21, 6, 4, 38, 74, 18, 1, 11, 44, 19, 21, 3, 7, 16, 46, 9, 1, 19, 3, 2, 31, 5], [52, 29, 18, 20, 54, 37, 39, 4, 16, 86, 22, 22, 16, 8, 64, 13, 7, 20, 23, 102, 33, 5, 12, 7, 3, 29, 32, 11, 10, 27, 22, 19, 101], [123, 82, 49, 33, 128, 54, 18, 37, 21, 302, 71, 35, 35, 40, 114, 48, 29, 30, 48, 156, 65, 51, 22, 31, 22, 25, 51, 51, 26, 37, 49, 47, 27], [142, 204, 168, 40, 235, 262, 59, 50, 38, 137, 117, 65, 51, 48, 55, 97, 102, 40, 101, 26, 130, 121, 37, 78, 62, 1, 9, 46, 77, 2, 25, 66, 35], [4, 9, 144, 237, 3, 13, 92, 73, 74, 120, 3, 17, 64, 75, 12, 7, 71, 57, 31, 9, 5, 95, 53, 8, 31, 2, 7, 52, 13, 1, 26, 1, 2], [36, 8, 7, 6, 17, 15, 5, 5, 3, 23, 9, 3, 2, 7, 26, 10, 6, 16, 24, 15, 35, 12, 9, 3, 1, 39, 4, 2, 2, 14, 3, 5, 25], [13, 10, 26, 9, 7, 9, 24, 3, 6, 15, 33, 39, 4, 14, 29, 2, 22, 4, 23, 44, 12, 7, 19, 30, 22, 28, 39, 25, 14, 29, 23, 34, 6], [8, 6, 17, 18, 9, 6, 9, 35, 12, 9, 15, 15, 39, 50, 1, 1, 7, 23, 6, 1, 3, 3, 3, 23, 73, 6, 6, 10, 43, 11, 7, 10, 5], [3, 9, 6, 6, 1, 1, 26, 9, 1, 4, 6, 1, 1, 1, 3, 5, 3, 3, 1, 1, 1, 2, 1, 1, 7, 1, 2, 1, 1, 2, 1, 2, 1], [1, 1, 1, 1, 1, 1, 5, 10, 0, 1, 0, 0, 1, 1, 1, 0, 2, 2, 0, 0, 1, 0, 2, 3, 2, 1, 1, 2, 2, 1, 1, 3, 5], [0, 2, 0, 4, 0, 0, 1, 1, 0, 0, 0, 0, 3, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 3, 1, 3, 0, 0, 2, 1, 0, 0], [0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0], [0, 1, 1, 0, 0, 1, 9, 3, 1, 0, 1, 0, 0, 2, 0, 1, 0, 3, 2, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0], [1, 2, 1, 0, 0, 1, 13, 6, 1, 1, 0, 0, 1, 2, 0, 0, 1, 1, 0, 0, 0, 1, 1, 3, 1, 1, 2, 0, 0, 1, 0, 0, 0], [0, 2, 2, 1, 0, 1, 1, 1, 1, 1, 1, 0, 2, 4, 0, 1, 2, 4, 2, 0, 1, 1, 2, 3, 1, 2, 2, 1, 1, 1, 1, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 3, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 2], [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 4, 8, 2, 2, 1, 2, 1, 10, 6, 1, 2, 1, 1, 4, 3, 8, 3, 16, 7, 2, 1], [12, 5, 0, 0, 2, 3, 1, 1, 2, 29, 15, 3, 1, 0, 1, 3, 4, 3, 2, 1, 9, 6, 4, 1, 1, 2, 1, 28, 5, 17, 22, 8, 1], [0, 1, 5, 1, 20, 15, 8, 11, 10, 64, 49, 34, 18, 11, 67, 42, 33, 21, 11, 61, 40, 35, 29, 1, 6, 1, 1, 1, 1, 1, 1, 1, 2], [0, 1, 1, 1, 20, 15, 9, 11, 1, 4, 4, 35, 20, 11, 68, 42, 35, 21, 12, 62, 41, 35, 30, 2, 1, 10, 1, 37, 4, 17, 34, 23, 1], [0, 0, 1, 0, 7, 7, 1, 2, 1, 3, 3, 1, 1, 36, 69, 88, 98, 75, 51, 21, 87, 144, 137, 11, 10, 108, 39, 58, 56, 26, 66, 86, 30], [0, 0, 0, 1, 2, 2, 2, 1, 1, 31, 1, 42, 44, 1, 70, 88, 99, 77, 51, 23, 87, 145, 138, 13, 8, 153, 98, 24, 22, 21, 16, 21, 7], [0, 0, 0, 3, 0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 7, 5, 6, 1, 9, 53, 83, 3, 83, 45, 33, 95, 33, 36, 32, 14, 4, 16, 5], [0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 2, 8, 7, 7, 2, 10, 54, 84, 3, 2, 47, 33, 39, 1, 36, 33, 16, 30, 146, 10], [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 4, 4, 3, 33, 30, 76, 52, 40, 24, 21, 2], [0, 2, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 5, 5, 4, 33, 31, 78, 52, 41, 52, 46, 2], [0, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 2, 1, 4, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 7, 0, 2, 1, 1, 3, 3, 3, 1], [1, 2, 1, 4, 1, 2, 2, 2, 3, 1, 1, 2, 2, 5, 1, 2, 2, 1, 1, 1, 1, 1, 1, 2, 7, 0, 1, 1, 1, 3, 3, 1, 5], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1, 2, 10, 0, 4, 1, 5, 9, 1, 1, 2], [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 0, 2, 2, 0, 0, 0, 0, 1, 4, 0, 1, 0, 1, 11, 2, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 4, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 4, 0, 0, 0, 0, 4, 0, 0, 0, 5, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 20, 7, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 3, 1, 0, 0, 0, 4, 2, 0, 0, 0, 1, 0, 0, 0, 0, 5, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0], [5, 1, 7, 1, 8, 1, 1, 0, 0, 5, 11, 2, 8, 1, 5, 9, 1, 16, 7, 18, 18, 15, 5, 4, 1, 17, 4, 0, 0, 12, 1, 0, 0], [17, 9, 3, 2, 1, 1, 2, 2, 2, 2, 7, 16, 9, 2, 15, 6, 2, 17, 9, 34, 23, 17, 7, 6, 2, 19, 5, 1, 0, 13, 2, 1, 1], [3, 6, 9, 2, 9, 3, 2, 5, 2, 15, 5, 1, 27, 13, 19, 6, 4, 32, 24, 51, 5, 98, 70, 44, 15, 3, 2, 28, 13, 45, 41, 8, 7], [4, 1, 10, 2, 11, 4, 3, 1, 1, 17, 6, 2, 28, 14, 19, 7, 1, 33, 25, 53, 1, 1, 70, 1, 1, 5, 3, 29, 14, 46, 42, 10, 9], [31, 18, 7, 4, 19, 3, 15, 8, 1, 17, 10, 3, 19, 8, 46, 49, 21, 19, 2, 60, 4, 1, 2, 1, 59, 12, 7, 36, 60, 15, 14, 12, 1], [32, 19, 8, 4, 21, 5, 15, 9, 2, 18, 11, 4, 20, 8, 47, 50, 22, 20, 4, 61, 5, 1, 4, 1, 60, 13, 8, 37, 61, 15, 15, 13, 2], [51, 31, 35, 21, 50, 30, 37, 44, 37, 65, 26, 11, 4, 19, 13, 4, 4, 6, 4, 18, 10, 13, 8, 6, 3, 2, 1, 1, 1, 2, 1, 1, 23], [52, 32, 36, 22, 51, 31, 39, 45, 37, 65, 26, 12, 4, 1, 14, 6, 5, 6, 5, 19, 10, 15, 9, 7, 4, 2, 2, 2, 3, 3, 2, 2, 24], [40, 45, 31, 23, 80, 14, 8, 64, 34, 54, 47, 36, 24, 6, 2, 28, 1, 34, 1, 45, 85, 25, 6, 6, 32, 20, 19, 5, 4, 2, 21, 10, 6], [41, 45, 33, 24, 81, 15, 8, 65, 35, 55, 48, 37, 25, 7, 3, 29, 2, 34, 3, 45, 86, 26, 7, 7, 32, 20, 20, 5, 5, 4, 23, 12, 7], [89, 60, 43, 32, 56, 35, 15, 25, 7, 44, 85, 34, 44, 42, 63, 50, 1, 44, 1, 36, 40, 38, 40, 72, 78, 33, 60, 11, 2, 5, 21, 49, 69], [89, 60, 45, 33, 58, 36, 16, 26, 8, 45, 86, 35, 44, 51, 64, 51, 1, 45, 2, 37, 41, 39, 41, 73, 78, 34, 61, 12, 3, 6, 23, 51, 69], [203, 90, 51, 40, 78, 60, 38, 65, 14, 97, 62, 31, 22, 13, 79, 51, 24, 22, 17, 71, 68, 30, 51, 43, 32, 35, 118, 6, 52, 10, 88, 40, 32], [204, 91, 51, 41, 80, 61, 39, 65, 16, 98, 64, 32, 22, 15, 79, 52, 24, 23, 18, 73, 106, 31, 52, 44, 33, 36, 118, 7, 53, 11, 88, 41, 33], [42, 227, 115, 59, 10, 17, 48, 67, 61, 51, 90, 35, 32, 24, 29, 29, 21, 29, 15, 51, 17, 24, 6, 10, 11, 29, 25, 23, 58, 2, 8, 6, 8], [43, 229, 116, 59, 10, 18, 49, 69, 62, 53, 91, 36, 33, 26, 30, 30, 23, 31, 15, 52, 18, 25, 7, 10, 11, 30, 26, 23, 1, 3, 9, 7, 9], [16, 23, 7, 2, 35, 27, 40, 6, 3, 1, 52, 84, 86, 64, 145, 112, 94, 92, 67, 43, 92, 48, 66, 86, 62, 36, 3, 11, 12, 28, 5, 2, 3], [17, 24, 9, 3, 36, 27, 41, 8, 4, 2, 53, 85, 86, 65, 146, 114, 95, 93, 69, 45, 93, 49, 1, 2, 1, 37, 5, 1, 1, 29, 1, 1, 4], [4, 11, 6, 47, 5, 61, 38, 23, 50, 5, 61, 71, 42, 20, 48, 37, 37, 42, 34, 100, 113, 55, 9, 24, 56, 21, 17, 42, 14, 6, 13, 67, 56], [5, 12, 7, 48, 6, 62, 39, 24, 50, 7, 62, 72, 43, 21, 48, 38, 38, 43, 36, 101, 114, 56, 10, 25, 56, 22, 17, 1, 1, 7, 14, 67, 56], [2, 19, 2, 22, 4, 33, 9, 8, 26, 6, 52, 36, 33, 41, 14, 9, 60, 75, 29, 21, 50, 53, 79, 73, 40, 58, 44, 39, 45, 48, 66, 50, 32], [3, 20, 2, 23, 4, 35, 9, 9, 27, 1, 54, 37, 34, 41, 14, 11, 60, 76, 29, 22, 50, 54, 80, 74, 41, 59, 45, 40, 45, 49, 67, 52, 34], [18, 16, 16, 13, 31, 19, 21, 25, 8, 4, 33, 9, 9, 1, 1, 5, 4, 9, 4, 5, 6, 2, 20, 28, 23, 6, 9, 6, 7, 10, 19, 51, 26], [20, 17, 17, 1, 33, 20, 22, 27, 1, 6, 34, 10, 11, 1, 1, 6, 6, 10, 5, 1, 1, 4, 21, 29, 24, 7, 10, 7, 8, 1, 20, 51, 27], [23, 19, 7, 4, 29, 9, 8, 9, 5, 17, 30, 21, 29, 7, 3, 1, 2, 5, 4, 2, 9, 1, 59, 30, 43, 19, 67, 68, 1, 5, 62, 83, 46], [25, 20, 8, 5, 30, 10, 10, 9, 6, 1, 30, 22, 30, 8, 4, 2, 3, 6, 6, 2, 10, 2, 60, 31, 44, 19, 68, 1, 2, 7, 64, 85, 47], [24, 35, 26, 13, 1, 18, 26, 3, 24, 6, 35, 31, 8, 3, 6, 52, 13, 70, 12, 26, 31, 25, 13, 2, 2, 33, 5, 71, 118, 51, 20, 19, 12], [25, 37, 27, 14, 2, 19, 27, 3, 26, 7, 37, 32, 9, 3, 8, 53, 13, 70, 12, 27, 32, 26, 14, 3, 3, 34, 6, 73, 118, 52, 20, 19, 13], [38, 9, 30, 31, 24, 72, 59, 54, 30, 16, 18, 18, 58, 61, 27, 24, 1, 15, 11, 59, 26, 78, 48, 14, 4, 71, 50, 55, 20, 37, 71, 70, 24], [39, 10, 30, 32, 1, 73, 60, 55, 31, 34, 19, 19, 59, 62, 28, 24, 3, 15, 12, 60, 27, 79, 48, 15, 5, 71, 52, 56, 20, 38, 71, 70, 25], [48, 34, 21, 42, 11, 33, 56, 60, 37, 1, 4, 7, 3, 16, 3, 8, 13, 9, 6, 4, 1, 4, 23, 11, 6, 15, 20, 3, 3, 41, 30, 30, 23], [50, 34, 22, 43, 12, 34, 56, 61, 38, 2, 4, 7, 4, 16, 3, 9, 14, 10, 8, 4, 1, 5, 23, 13, 7, 16, 21, 3, 4, 42, 31, 30, 24], [22, 75, 75, 12, 72, 22, 37, 47, 1, 2, 7, 15, 4, 89, 48, 11, 21, 19, 23, 2, 43, 14, 18, 11, 8, 35, 1, 1, 14, 91, 2, 1, 3], [23, 76, 76, 12, 73, 23, 38, 48, 2, 3, 8, 1, 4, 3, 50, 12, 22, 10, 8, 3, 44, 34, 19, 13, 9, 37, 2, 1, 1, 92, 3, 2, 4], [4, 4, 14, 7, 6, 5, 5, 22, 9, 14, 16, 4, 44, 51, 1, 9, 2, 17, 1, 43, 19, 41, 25, 11, 19, 87, 32, 6, 7, 20, 26, 12, 4], [6, 5, 16, 7, 7, 1, 6, 24, 10, 15, 17, 6, 45, 52, 2, 9, 3, 17, 1, 44, 20, 41, 26, 12, 21, 87, 33, 8, 8, 21, 27, 12, 6], [89, 4, 8, 1, 27, 20, 2, 4, 1, 2, 2, 9, 22, 32, 48, 49, 19, 11, 14, 24, 2, 61, 23, 11, 18, 13, 16, 3, 2, 6, 28, 8, 21], [90, 5, 9, 1, 28, 21, 2, 5, 1, 2, 2, 9, 22, 33, 49, 1, 21, 11, 16, 25, 3, 62, 24, 12, 19, 14, 17, 10, 28, 15, 29, 9, 21], [26, 30, 94, 45, 238, 99, 23, 20, 24, 1, 167, 5, 12, 11, 10, 21, 51, 2, 1, 27, 1, 7, 1, 148, 95, 2, 1, 30, 1, 9, 1, 1, 5], [27, 1, 96, 46, 239, 99, 25, 21, 25, 3, 1, 7, 1, 11, 10, 23, 51, 3, 2, 29, 1, 8, 2, 1, 1, 2, 1, 1, 1, 10, 2, 2, 6], [22, 5, 27, 4, 8, 95, 6, 4, 2, 1, 83, 7, 29, 38, 3, 79, 9, 14, 14, 1, 1, 8, 10, 90, 1, 7, 2, 8, 8, 54, 35, 7, 1], [22, 55, 27, 2, 10, 96, 2, 6, 3, 1, 18, 16, 66, 39, 2, 1, 11, 1, 1, 2, 2, 9, 1, 91, 1, 8, 2, 1, 10, 54, 1, 1, 2], [5, 2, 7, 7, 13, 13, 7, 49, 3, 29, 28, 10, 91, 36, 3, 103, 10, 51, 59, 1, 5, 113, 34, 53, 51, 55, 43, 9, 9, 73, 26, 8, 25], [6, 3, 9, 7, 13, 13, 8, 2, 3, 1, 30, 11, 92, 37, 4, 1, 11, 51, 61, 2, 6, 114, 35, 54, 53, 57, 45, 11, 10, 1, 27, 10, 26], [15, 21, 30, 72, 3, 11, 42, 74, 16, 5, 18, 11, 35, 18, 12, 4, 15, 16, 4, 14, 19, 31, 6, 5, 4, 37, 5, 6, 15, 27, 16, 26, 36], [17, 21, 31, 73, 5, 12, 43, 75, 16, 6, 19, 17, 99, 77, 13, 5, 1, 89, 1, 15, 19, 80, 125, 100, 1, 1, 82, 95, 85, 1, 64, 58, 17], [3, 10, 1, 6, 22, 2, 2, 21, 3, 5, 6, 5, 1, 9, 5, 11, 1, 1, 44, 43, 19, 2, 1, 8, 46, 1, 2, 1, 69, 1, 1, 10, 4], [4, 1, 2, 7, 2, 3, 3, 23, 4, 6, 7, 6, 1, 2, 6, 11, 2, 2, 1, 43, 20, 4, 1, 9, 1, 2, 4, 1, 70, 2, 1, 11, 1], [1, 1, 60, 1, 88, 1, 84, 1, 26, 53, 124, 35, 131, 83, 77, 80, 184, 128, 38, 123, 61, 3, 1, 1, 42, 29, 3, 25, 2, 2, 7, 1, 1], [91, 74, 61, 43, 89, 129, 85, 85, 27, 54, 125, 36, 132, 85, 78, 81, 185, 130, 39, 124, 63, 3, 1, 2, 1, 2, 5, 2, 1, 3, 9, 2, 3], [9, 38, 13, 10, 38, 31, 20, 17, 23, 35, 98, 77, 93, 45, 87, 96, 61, 54, 32, 58, 106, 6, 6, 1, 4, 6, 3, 3, 5, 2, 4, 17, 2], [9, 39, 14, 11, 39, 32, 20, 17, 23, 36, 98, 78, 94, 45, 89, 97, 62, 55, 32, 58, 108, 7, 7, 1, 1, 7, 3, 5, 6, 3, 2, 18, 3], [2, 3, 1, 4, 1, 4, 1, 1, 3, 2, 7, 3, 1, 28, 39, 133, 111, 51, 31, 73, 80, 2, 3, 40, 1, 3, 3, 1, 2, 11, 9, 6, 4], [1, 4, 2, 5, 1, 5, 1, 0, 5, 3, 7, 1, 2, 30, 41, 135, 112, 52, 32, 73, 81, 3, 2, 2, 3, 4, 4, 4, 3, 12, 9, 6, 5], [1, 0, 0, 1, 2, 3, 0, 4, 0, 0, 30, 43, 49, 9, 34, 298, 136, 50, 13, 16, 35, 126, 41, 12, 14, 19, 100, 19, 30, 76, 1, 28, 8], [2, 0, 0, 2, 2, 4, 1, 4, 2, 1, 31, 44, 51, 11, 35, 300, 136, 52, 15, 17, 35, 128, 42, 12, 14, 20, 102, 1, 31, 1, 2, 29, 9], [4, 1, 0, 1, 2, 1, 1, 5, 0, 0, 1, 0, 0, 1, 3, 11, 10, 8, 5, 1, 5, 9, 11, 2, 5, 12, 154, 51, 11, 109, 67, 4, 1], [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 3, 0, 0, 0, 5, 0, 0, 0]];
function getRainData() {
  return {
    points: position,
    data: data$1,
    timeList: timeList$1,
    breaks: [
      { min: 0, max: 10, color: "rgba(166, 255, 176, 1)" },
      { min: 10, max: 25, color: "rgba(30, 186, 37, 1)" },
      { min: 25, max: 50, color: "rgba(95, 207, 255, 1)" },
      { min: 50, max: 100, color: "rgba(0, 0, 255, 1)" },
      { min: 100, max: 250, color: "rgba(249, 0, 241, 1)" },
      { min: 250, max: Infinity, color: "rgba(255, 0, 0, 1)" }
    ],
    extent: calcExtent(position)
  };
}
function calcExtent(points2) {
  const extent2 = {
    xmin: Infinity,
    xmax: -Infinity,
    ymin: Infinity,
    ymax: -Infinity
  };
  for (let p of points2) {
    const { x, y } = p;
    extent2.xmin = Math.min(extent2.xmin, x);
    extent2.xmax = Math.max(extent2.xmax, x);
    extent2.ymin = Math.min(extent2.ymin, y);
    extent2.ymax = Math.max(extent2.ymax, y);
  }
  return extent2;
}
function WorkerWrapper(options) {
  return new Worker(
    "" + new URL("worker-DmafqJZZ.js", import.meta.url).href,
    {
      name: options?.name
    }
  );
}
const workerGerenate = (() => {
  const worker = new WorkerWrapper();
  let taskId = 0;
  const taskMap = /* @__PURE__ */ new Map();
  worker.onmessage = (e) => {
    const { id, result, success, error: error2 } = e.data;
    const handle = taskMap.get(id);
    if (success) {
      handle.resolve(result);
    } else {
      handle.reject(error2);
    }
    taskMap.delete(id);
  };
  const gerenate = (opts) => {
    const { promise, resolve, reject } = withResolvers();
    const id = taskId++;
    worker.postMessage({ data: opts, id });
    taskMap.set(id, { resolve, reject });
    return promise;
  };
  return gerenate;
})();
const handleChange = debounce(renderData, 300, { edges: ["trailing"] });
const rainData = getRainData();
console.log(rainData);
const { data, points, extent, breaks, timeList } = rainData;
const xs = points.map((i) => i.x);
const ys = points.map((i) => i.y);
{
  const el = document.body.querySelector("#data");
  const rowStyle = `style="grid-template-columns: 190px repeat(${points.length}, var(--cell));"`;
  const header = `<div class="row" ${rowStyle}>
         <div></div>
         ${new Array(points.length).fill(0).map((_, idx) => `<div>P${idx}
</div>`).join("")}
    </div>`;
  el.innerHTML = `
        ${header}
        ${new Array(timeList.length).fill(0).map((_, timeIndex) => {
    const time = timeList[timeIndex].slice(0, 16);
    return `<div class="row" ${rowStyle} data-index=${timeIndex}>
                        <div>${time}(${timeIndex})</div>
                        ${data[timeIndex].map((_2, j) => `<div>${data[timeIndex][j]}</div>`).join("")}
                    </div>`;
  }).join("")}
    `;
  let last = el.children[11 + 1];
  last.classList.add("is-select");
  el.addEventListener("click", (e) => {
    let target = e.target;
    while (target.parentElement !== el) {
      target = target.parentElement;
    }
    if (last === target) return;
    last?.classList.remove("is-select");
    target.classList.add("is-select");
    const index = +target.dataset.index;
    handleChange(index);
    last = target;
  });
}
const legend = document.createElement("div");
legend.classList.add("legend");
legend.innerHTML = breaks.map((i) => {
  return `<div class="legend-item">
            <div class="icon" style="background-color:${i.color}"></div>
            <label>${i.min}~${i.max}</label>
        </div>`;
}).join("");
document.body.appendChild(legend);
const { xmin, xmax, ymin, ymax } = expandFactor(extent, 1.5);
const width = xmax - xmin;
const height = ymax - ymin;
const cellSize = Math.max(width, height) / 300;
const cols = Math.round(width / cellSize);
const rows = Math.round(height / cellSize);
const glsl_breaks = `
struct Break {
    float min;
    float max;
    vec4 color;
};

const int BreakLength = ${breaks.length};

const Break list[${breaks.length}] = Break[${breaks.length}](
    ${breaks.map(({ min, max, color }) => {
  const color_str = colorToRGBA(color).map((i) => (i / 255).toFixed(1)).join(",");
  return `Break(${min.toFixed(1)}, ${isFinite(max) ? max.toFixed(1) : "9999999.0"}, vec4(${color_str}))`;
}).join(",\n")}
);    
`;
const render_cpuCalcPixel = (() => {
  const el = document.body.querySelector("#raw");
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const info = el.querySelector("div");
  return (rawBuffer, data2, time) => {
    canvas.width = cols;
    canvas.height = rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const val = rawBuffer[y * cols + x];
        const color = getColor(val, breaks);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "black";
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = (p.x - xmin) / width * canvas.width;
      const y = (ymax - p.y) / height * canvas.height;
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillText(data2[i].toFixed(0), x, y);
    }
    info.innerHTML = `<span red>${time.toFixed(2)}ms</span>`;
  };
})();
const renderWEBGL_packedImagebitmap = (() => {
  const el = document.body.querySelector("#packed-imagebitmap");
  const canvas = el.children[1];
  const ctx = canvas.getContext("2d");
  const info1 = el.children[2];
  const canvas2 = el.children[3];
  const gl = canvas2.getContext("webgl2");
  const info2 = el.children[4];
  const vs = `#version 300 es
        layout(location = 0) in vec2 position; 
        out vec2 v_uv; 
        void main(){
            v_uv = position;
            gl_Position = vec4(position * 2.0 - 1.0, 0, 1);
        }
    `;
  const fs = `#version 300 es
        precision highp float;

        ${glsl_breaks}

        uniform vec2 packRange;
        uniform sampler2D map;
        ${glsl_pack}
        in vec2 v_uv;
        out vec4 out_color;
        void main(){
            vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
            vec3 packed_rgb = texture(map, uv).rgb;
            float normalized_value = unpackRGBToNormalizeFloat(packed_rgb);
            float value = mix( packRange.x, packRange.y, normalized_value);
            vec4 color = list[0].color;
            for(int i = 0; i < BreakLength ; i++){
                Break b = list[i];
                if(value < b.max) {
                    color = b.color;
                    break;
                }
            }
            out_color = color;
        }   
    `;
  const program = createProgram(gl, [vs, fs]);
  gl.useProgram(program);
  const positionBuffer = createBufferFromTypedArray(gl, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  const uniformLocation = {
    packRange: gl.getUniformLocation(program, "packRange"),
    map: gl.getUniformLocation(program, "map")
  };
  gl.uniform1i(uniformLocation.map, 0);
  return (packedImageBitmap, valueRange, packTime) => {
    canvas.width = cols;
    canvas.height = rows;
    ctx.drawImage(packedImageBitmap, 0, 0);
    canvas2.width = cols;
    canvas2.height = rows;
    const s2 = performance.now();
    gl.viewport(0, 0, canvas2.width, canvas2.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2fv(uniformLocation.packRange, valueRange);
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, packedImageBitmap);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const drawTime = performance.now() - s2;
    packedImageBitmap.close();
    gl.deleteTexture(texture);
    info1.innerHTML = `pack time: <span red>${packTime.toFixed(2)} ms</span>`;
    info2.innerHTML = `render time: <span red>${drawTime.toFixed(2)}ms</span>`;
  };
})();
const renderWEBGL_imagebitmap = (() => {
  const el = document.body.querySelector("#imagebitmap");
  const canvas = el.children[1];
  const ctx = canvas.getContext("2d");
  const info = el.children[2];
  canvas.addEventListener("mousemove", (e) => {
    if (e.altKey) {
      const px = e.offsetX / canvas.width * width + xmin;
      const py = ymax - e.offsetY / canvas.height * height;
      console.log([px, py]);
    }
  });
  return (imageBitmap, gernateTime) => {
    canvas.width = cols;
    canvas.height = rows;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();
    info.innerHTML = `gerenate time: <span red>${gernateTime.toFixed(2)}ms</span>`;
  };
})();
const renderWEBGL_buffer = (() => {
  const el = document.body.querySelector("#buffer");
  const canvas = el.children[1];
  const info = el.children[2];
  const gl = canvas.getContext("webgl2");
  const vs = `#version 300 es
        layout(location = 0) in vec2 position; 
        out vec2 v_uv;
        void main(){
            v_uv = position;
            gl_Position = vec4(position * 2.0 - 1.0, 0, 1);
        }
`;
  const fs = `#version 300 es
            precision highp float;

            ${glsl_breaks}

            uniform sampler2D map;
            ${glsl_pack}
            in vec2 v_uv;
            out vec4 out_color;
            void main(){
                vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
                float value = texture(map, uv).r;
                vec4 color = list[0].color;
                for (int i = 0; i < BreakLength ; i++) {
                        Break b = list[i];
                    if (value < b.max) {
                        color = b.color;
                        break;
                    }
                }
            out_color = color;
            }
`;
  const program = createProgram(gl, [vs, fs]);
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, "map"), 0);
  const positionBuffer = createBufferFromTypedArray(gl, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  return (buffer, gernateTime) => {
    canvas.width = cols;
    canvas.height = rows;
    const s1 = performance.now();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, cols, rows, 0, gl.RED, gl.FLOAT, buffer);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const drawTime = performance.now() - s1;
    gl.deleteTexture(texture);
    info.innerHTML = `
            gl.readPixel: <span red>${gernateTime.toFixed(2)} ms</span>,
            redraw: <span red>${drawTime.toFixed(2)} ms</span>
        `;
  };
})();
async function renderData(i) {
  const [min, max] = [
    Math.min.apply(null, data[i]),
    Math.max.apply(null, data[i])
  ];
  const {
    rawBuffer,
    time_rawBuffer,
    packedImagebitmap,
    time_packedImagebitmap,
    imagebitmap,
    time_imagebitmap,
    valueBuffer,
    time_valuebuffer
  } = await workerGerenate({
    data: data[i],
    xs,
    ys,
    llCorner: [xmin, ymin],
    cellSize,
    gridSize: [cols, rows],
    colorMapping: breaks,
    packValueRange: [min, max]
  });
  render_cpuCalcPixel(rawBuffer, data[i], time_rawBuffer);
  renderWEBGL_imagebitmap(imagebitmap, time_imagebitmap);
  renderWEBGL_buffer(valueBuffer, time_valuebuffer);
  renderWEBGL_packedImagebitmap(packedImagebitmap, [min, max], time_packedImagebitmap);
}
renderData(11);
function getColor(v, breaks2) {
  if (v < breaks2[0].min) return breaks2[0].color;
  if (v >= breaks2[breaks2.length - 1].max) return breaks2[breaks2.length - 1].color;
  for (let i = 0; i < breaks2.length; i++) {
    if (v >= breaks2[i].min && v < breaks2[i].max) {
      return breaks2[i].color;
    }
  }
}
function expandFactor(extent2, factor) {
  const cx = (extent2.xmin + extent2.xmax) / 2;
  const cy = (extent2.ymin + extent2.ymax) / 2;
  const hw = (extent2.xmax - extent2.xmin) / 2 * factor;
  const hh = (extent2.ymax - extent2.ymin) / 2 * factor;
  return {
    xmin: cx - hw,
    xmax: cx + hw,
    ymin: cy - hh,
    ymax: cy + hh
  };
}
//# sourceMappingURL=index-_JZWZcr4.js.map
