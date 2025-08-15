import { debounce } from 'es-toolkit';
import { createBufferFromTypedArray, createProgram } from "twgl.js";
import { colorToRGBA } from '../src/supports';
import { glsl_pack } from '../src/webgl/glsl';
import { getRainData } from './data';
import './style.scss';

import type { gernerateMulti } from './worker';
import MyWorker from './worker?worker';
const workerGerenate = (() => {
    const worker = new MyWorker();
    let taskId = 0;
    const taskMap = new Map<number, {
        resolve: (r: any) => void,
        reject: (e: any) => void
    }>();
    worker.onmessage = e => {
        const { id, result, success, error } = e.data;
        const handle = taskMap.get(id);
        if (success) {
            handle.resolve(result);
        } else {
            handle.reject(error)
        }
        taskMap.delete(id);
    };
    const gerenate = (opts: any) => {
        const { promise, resolve, reject } = Promise.withResolvers();
        const id = taskId++;
        worker.postMessage({ data: opts, id });
        taskMap.set(id, { resolve, reject });
        return promise;
    }
    return gerenate as unknown as typeof gernerateMulti
})();


const handleChange = debounce(renderData, 300, { edges: ['trailing'] });
const rainData = getRainData();
console.log(rainData);
const { data, points, extent, breaks, timeList } = rainData;
const xs = points.map(i => i.x);
const ys = points.map(i => i.y);


{
    const el = document.body.querySelector('#data') as HTMLDivElement;
    const rowStyle = `style="grid-template-columns: 190px repeat(${points.length}, var(--cell));"`
    //(${position[idx].x},${position[idx].y})
    const header = `<div class="row" ${rowStyle}>
         <div></div>
         ${new Array(points.length).fill(0).map((_, idx) => `<div>P${idx}\n</div>`).join('')}
    </div>`;
    el.innerHTML = `
        ${header}
        ${new Array(timeList.length).fill(0).map((_, timeIndex) => {
        const time = timeList[timeIndex].slice(0, 16);
        return `<div class="row" ${rowStyle} data-index=${timeIndex}>
                        <div>${time}(${timeIndex})</div>
                        ${data[timeIndex].map((_, j) => `<div>${data[timeIndex][j]}</div>`).join('')}
                    </div>`;
    }).join('')
        }
    `;
    let last = el.children[11 + 1];
    last.classList.add('is-select');
    el.addEventListener('click', (e) => {
        let target = e.target as HTMLDivElement;
        while (target.parentElement !== el) {
            target = target.parentElement as HTMLDivElement;
        };
        if (last === target) return;
        last?.classList.remove('is-select');
        target.classList.add('is-select');
        const index = +target.dataset.index;
        handleChange(index);
        last = target;
    });
}

//add legend 
const legend = document.createElement('div');
legend.classList.add('legend');
legend.innerHTML = breaks.map(i => {
    return `<div class="legend-item">
            <div class="icon" style="background-color:${i.color}"></div>
            <label>${i.min}~${i.max}</label>
        </div>`
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
    const color_str = colorToRGBA(color).map(i => (i / 255).toFixed(1)).join(',')
    return `Break(${min.toFixed(1)}, ${isFinite(max) ? max.toFixed(1) : '9999999.0'}, vec4(${color_str}))`
}).join(',\n')}
);    
`

const render_cpuCalcPixel = (() => {
    const el = document.body.querySelector('#raw');
    const canvas = el.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const info = el.querySelector('div');
    return (rawBuffer: Float32Array, data: number[], time: number) => {
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
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'black';
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const x = (p.x - xmin) / width * canvas.width;
            const y = (ymax - p.y) / height * canvas.height;
            ctx.fillRect(x - 2, y - 2, 4, 4);
            ctx.fillText(data[i].toFixed(0), x, y);
        }
        info.innerHTML = `<span red>${time.toFixed(2)}ms</span>`
    }
})();

const renderWEBGL_packedImagebitmap = (() => {
    const el = document.body.querySelector('#packed-imagebitmap');
    const canvas = el.children[1] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const info1 = el.children[2];
    const canvas2 = el.children[3] as HTMLCanvasElement;
    const gl = canvas2.getContext('webgl2');
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
        packRange: gl.getUniformLocation(program, 'packRange'),
        map: gl.getUniformLocation(program, 'map'),
    }
    gl.uniform1i(uniformLocation.map, 0);

    return (packedImageBitmap: ImageBitmap, valueRange: number[], packTime: number) => {
        canvas.width = cols;
        canvas.height = rows;
        ctx.drawImage(packedImageBitmap, 0, 0);

        //
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

        info1.innerHTML = `pack time: <span red>${(packTime).toFixed(2)} ms</span>`;
        info2.innerHTML = `render time: <span red>${drawTime.toFixed(2)}ms</span>`;
    }
})();

const renderWEBGL_imagebitmap = (() => {
    const el = document.body.querySelector('#imagebitmap');
    const canvas = el.children[1] as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const info = el.children[2];
    canvas.addEventListener('mousemove', e => {
        if (e.altKey) {
            const px = e.offsetX / canvas.width * width + xmin;
            const py = ymax - e.offsetY / canvas.height * height;
            console.log([px, py])
        }
    });
    return (imageBitmap: ImageBitmap, gernateTime: number) => {
        canvas.width = cols;
        canvas.height = rows;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageBitmap, 0, 0);
        imageBitmap.close();
        info.innerHTML = `gerenate time: <span red>${gernateTime.toFixed(2)}ms</span>`;
    }
})();

const renderWEBGL_buffer = (() => {
    const el = document.body.querySelector('#buffer');
    const canvas = el.children[1] as HTMLCanvasElement;
    const info = el.children[2];
    const gl = canvas.getContext('webgl2');

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
    gl.uniform1i(gl.getUniformLocation(program, 'map'), 0);

    const positionBuffer = createBufferFromTypedArray(gl, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);


    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    return (buffer: Float32Array, gernateTime: number) => {
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
    }
})()


async function renderData(i: number) {
    const [min, max] = [
        Math.min.apply(null, data[i]),
        Math.max.apply(null, data[i]),
    ];
    const { 
        rawBuffer, time_rawBuffer,
        packedImagebitmap, time_packedImagebitmap,
        imagebitmap, time_imagebitmap,
        valueBuffer, time_valuebuffer
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


function getColor(v: number, breaks: { min: number; max: number; color: string }[]) {
    if (v < breaks[0].min) return breaks[0].color;
    if (v >= breaks[breaks.length - 1].max) return breaks[breaks.length - 1].color;
    for (let i = 0; i < breaks.length; i++) {
        if (v >= breaks[i].min && v < breaks[i].max) {
            return breaks[i].color
        }
    }
}
function expandFactor(extent: { xmin: number, ymin: number, xmax: number, ymax: number }, factor: number) {
    if (factor === 0) return extent;
    const cx = (extent.xmin + extent.xmax) / 2;
    const cy = (extent.ymin + extent.ymax) / 2;
    const hw = (extent.xmax - extent.xmin) / 2 * factor;
    const hh = (extent.ymax - extent.ymin) / 2 * factor;
    return {
        xmin: cx - hw,
        xmax: cx + hw,
        ymin: cy - hh,
        ymax: cy + hh,
    }
}

