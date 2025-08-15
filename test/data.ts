type P = {
    x: number,
    y: number,
    ID: string,
}
import { data, timeList, position } from './rain.json';

export function getRainData() {
    
    return {
        points: position,
        data,
        timeList,
        breaks: [
            { min: 0, max: 10, color: "rgba(166, 255, 176, 1)", },
            { min: 10, max: 25, color: "rgba(30, 186, 37, 1)", },
            { min: 25, max: 50, color: "rgba(95, 207, 255, 1)", },
            { min: 50, max: 100, color: "rgba(0, 0, 255, 1)", },
            { min: 100, max: 250, color: "rgba(249, 0, 241, 1)", },
            { min: 250, max: Infinity, color: "rgba(255, 0, 0, 1)", },
        ],
        extent: calcExtent(position),
    };
}
function calcExtent(points: P[]) {
    const extent = {
        xmin: Infinity,
        xmax: -Infinity,
        ymin: Infinity,
        ymax: -Infinity,
    }
    for (let p of points as P[]) {
        const { x, y } = p;
        extent.xmin = Math.min(extent.xmin, x);
        extent.xmax = Math.max(extent.xmax, x);
        extent.ymin = Math.min(extent.ymin, y);
        extent.ymax = Math.max(extent.ymax, y);
    }
    return extent
}