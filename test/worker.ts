import { createVariogramObject, generate_WEBGL, predict, train, type Variogram } from "../src";
import type { ColorMappingObject } from "../src/supports";
import { getGenerateCtx } from "../src/webgl/generate";
import { createColorMappingObject, getGLCtx } from "../src/webgl/utils";

self.onmessage = async e => {
    //手动初始化，避免初始化时间算入gernerate中
    await getGLCtx();
    await getGenerateCtx();

    const result = await gernerateMulti(e.data.data);
    self.postMessage({
        id: e.data.id,
        result,
        success: true
    }, [
        result.imagebitmap, 
        result.packedImagebitmap, 
        result.rawBuffer.buffer, 
        result.valueBuffer.buffer
    ]);
}

let colorMapping_object: ColorMappingObject;
export async function gernerateMulti({ data, xs, ys, llCorner, cellSize, gridSize, colorMapping, packValueRange }: {
    data: number[],
    xs: number[],
    ys: number[],
    llCorner: number[],
    cellSize: number,
    gridSize: number[],
    colorMapping: { min: number, max: number, color: string }[],
    packValueRange: number[]
}) {
    colorMapping_object ??= createColorMappingObject(colorMapping); //in this example it not change

    let start = performance.now();
    const variogram = train(
        data,
        xs,
        ys,
        'exponential',
        0,
        10
    );
    const trainTime = performance.now() - start;
    console.log(trainTime);
    const variogram_object = createVariogramObject(variogram);

    start = performance.now();
    const rawBuffer = generate_normal(variogram, {
        llCorner,
        gridSize,
        cellSize,
    });
    const time_rawBuffer = performance.now() - start;

    start = performance.now();
    const imagebitmap = await generate_WEBGL({
        variogram: variogram_object,
        llCorner,
        cellSize,
        gridSize,
        colorMapping: colorMapping_object,
        outputFormat: 'imagebitmap'
    });
    const time_imagebitmap = performance.now() - start;

    start = performance.now();
    const packedImagebitmap = await generate_WEBGL({
        variogram: variogram_object,
        llCorner,
        cellSize,
        gridSize,
        packValueRange,
        outputFormat: 'packed-imagebitmap'
    });
    const time_packedImagebitmap = performance.now() - start;

    start = performance.now();
    const valueBuffer = await generate_WEBGL({
        variogram: variogram_object,
        llCorner,
        cellSize,
        gridSize,
        outputFormat: 'value-buffer'
    });
    const time_valuebuffer = performance.now() - start;

    variogram_object.dispose();
    return {
        rawBuffer,
        imagebitmap,
        packedImagebitmap,
        valueBuffer,
        time_imagebitmap,
        time_packedImagebitmap,
        time_valuebuffer,
        time_rawBuffer
    }
}


function generate_normal(variogram: Variogram, opts: {
    llCorner: number[],//[xmin, ymin]
    cellSize: number; //网格大小
    gridSize: number[];//网格数 [cols,rows]
}) {
    const { cellSize, llCorner, gridSize } = opts;
    const [cols, rows] = gridSize;
    const [xmin, ymin] = llCorner;
    const halfSize = cellSize / 2;
    const result = new Float32Array(cols * rows);
    const [ox, oy] = [xmin + halfSize, ymin + halfSize]; 
    for (let i = 0; i < rows; i++) {
        const cursor = (rows - 1 - i) * cols;
        const y = oy + i * cellSize;
        for (let j = 0; j < cols; j++) {
            result[cursor + j] = predict(ox + j * cellSize, y, variogram);
        }
    }
    return result;
}