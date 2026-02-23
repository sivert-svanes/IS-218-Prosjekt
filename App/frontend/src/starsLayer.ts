/**
 * MapLibre GL JS Stars Custom Layer (TypeScript)
 *
 * Adds a procedural starry background to globe projection views using a custom layer.
 * Stars are generated in a fragment shader and properly rotate with the globe camera.
 */

export interface StarsLayerOptions {
  id?: string;
  intensity?: number;
  density?: number;
}

export function createStarsLayer(options: StarsLayerOptions = {}) {
  const intensity = options.intensity || 20.0;
  const density = options.density || 0.15;

  // State held by the layer instance
  let layerMap: any = null;
  let program: WebGLProgram | null = null;
  let vertexBuffer: WebGLBuffer | null = null;
  let indexBuffer: WebGLBuffer | null = null;
  let aPos = -1;

  return {
    id: options.id || 'stars',
    type: 'custom' as const,
    renderingMode: '3d' as const,

    onAdd: function (map: any, gl: WebGLRenderingContext) {
      layerMap = map;

      try {
        // ── Vertex shader ─────────────────────────────────────────
        const vertexSource = `
          attribute vec2 a_pos;
          uniform mat4 u_inv_proj_matrix;
          varying vec3 view_direction;

          void main() {
            view_direction = (u_inv_proj_matrix * vec4(a_pos, 0.0, 1.0)).xyz;
            gl_Position = vec4(a_pos, 1.0, 1.0);
          }
        `;

        // ── Fragment shader ───────────────────────────────────────
        const fragmentSource = `
          precision highp float;
          varying vec3 view_direction;

          uniform vec3 u_globe_position;
          uniform float u_globe_radius;
          uniform float u_stars_intensity;
          uniform vec2 u_globe_center;
          uniform vec3 u_camera_angles;

          const float PI = 3.141592653589793;

          void main() {
            vec3 ray_dir = normalize(view_direction);
            vec3 rotated = ray_dir;

            // Apply camera rotations – pitch
            float cosPitch = cos(u_camera_angles.x);
            float sinPitch = sin(u_camera_angles.x);
            rotated = vec3(
              rotated.x,
              rotated.y * cosPitch - rotated.z * sinPitch,
              rotated.y * sinPitch + rotated.z * cosPitch
            );

            // bearing
            float cosBearing = cos(u_camera_angles.y);
            float sinBearing = sin(u_camera_angles.y);
            rotated = vec3(
              rotated.x * cosBearing - rotated.z * sinBearing,
              rotated.y,
              rotated.x * sinBearing + rotated.z * cosBearing
            );

            // roll
            float cosRoll = cos(u_camera_angles.z);
            float sinRoll = sin(u_camera_angles.z);
            rotated = vec3(
              rotated.x * cosRoll - rotated.y * sinRoll,
              rotated.x * sinRoll + rotated.y * cosRoll,
              rotated.z
            );

            // Apply globe rotation – latitude
            float cosLat = cos(u_globe_center.y);
            float sinLat = sin(u_globe_center.y);
            rotated = vec3(
              rotated.x,
              rotated.y * cosLat + rotated.z * sinLat,
              -rotated.y * sinLat + rotated.z * cosLat
            );

            // longitude
            float cosLng = cos(u_globe_center.x);
            float sinLng = sin(u_globe_center.x);
            rotated = vec3(
              rotated.x * cosLng + rotated.z * sinLng,
              rotated.y,
              -rotated.x * sinLng + rotated.z * cosLng
            );

            // ── Star field using cube-map projection ──────────────
            // Project the rotated direction onto the dominant cube face
            // and hash in that 2D space.  This avoids the equirectangular
            // pole singularity entirely — stars are uniform everywhere.

            vec3 absDir = abs(rotated);
            vec2 faceUV;
            float faceIndex;

            if (absDir.x >= absDir.y && absDir.x >= absDir.z) {
              // ±X face
              faceUV = rotated.yz / absDir.x;
              faceIndex = rotated.x > 0.0 ? 0.0 : 1.0;
            } else if (absDir.y >= absDir.x && absDir.y >= absDir.z) {
              // ±Y face
              faceUV = rotated.xz / absDir.y;
              faceIndex = rotated.y > 0.0 ? 2.0 : 3.0;
            } else {
              // ±Z face
              faceUV = rotated.xy / absDir.z;
              faceIndex = rotated.z > 0.0 ? 4.0 : 5.0;
            }

            // faceUV is in [-1, 1], remap to [0, 1]
            faceUV = faceUV * 0.5 + 0.5;

            // Scale to create grid cells per face
            float gridScale = 60.0;
            vec2 scaledUV = faceUV * gridScale;
            vec2 gridPos = floor(scaledUV);

            // Include face index in hash to avoid star duplication across faces
            float faceHash = faceIndex * 17.0;
            float hash = fract(sin(dot(gridPos + faceHash, vec2(12.9898, 78.233))) * 43758.5453);

            float stars = 0.0;
            if (hash > ${(1 - density).toFixed(2)}) {
              float hashX = fract(sin(dot(gridPos + faceHash, vec2(127.1, 311.7))) * 43758.5453);
              float hashY = fract(sin(dot(gridPos + faceHash, vec2(269.5, 183.3))) * 43758.5453);
              vec2 randomOffset = vec2(hashX, hashY);
              vec2 localPos = fract(scaledUV);
              vec2 delta = localPos - randomOffset;

              float dist = length(delta);
              float sizeHash = fract(sin(dot(gridPos + faceHash, vec2(415.2, 371.9))) * 43758.5453);
              float starSize = 0.025 + 0.025 * sizeHash;

              stars = 1.0 - smoothstep(0.0, starSize, dist);
              stars = pow(stars, 4.0);

              float brightness = 0.5 + 0.5 * sizeHash;
              stars *= brightness;
            }

            stars *= u_stars_intensity;
            vec3 starColor = vec3(1.0) * stars;

            gl_FragColor = vec4(starColor, 1.0);
          }
        `;

        // ── Compile shaders ───────────────────────────────────────
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
          console.error('Stars vertex shader error:', gl.getShaderInfoLog(vertexShader));
          return;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
          console.error('Stars fragment shader error:', gl.getShaderInfoLog(fragmentShader));
          return;
        }

        // ── Link program ──────────────────────────────────────────
        program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Stars program link error:', gl.getProgramInfoLog(program));
          program = null;
          return;
        }

        // ── Full-screen quad ──────────────────────────────────────
        const vertices = new Float32Array([
          -1, -1,
           1, -1,
           1,  1,
          -1,  1
        ]);
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        vertexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        indexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        aPos = gl.getAttribLocation(program, 'a_pos');
      } catch (e) {
        console.warn('Stars layer onAdd failed:', e);
        program = null; // ensure render is a no-op
      }
    },

    render: function (gl: WebGLRenderingContext, _matrix: number[]) {
      if (!layerMap || !program || !vertexBuffer || !indexBuffer) return;

      try {
        const transform = (layerMap as any).transform;
        if (!transform || !transform.inverseProjectionMatrix) return;

        // Only render in globe projection — guard against missing API
        if (typeof transform.getProjectionData === 'function') {
          const projectionData = transform.getProjectionData({
            overscaledTileID: null,
            applyGlobeMatrix: true,
            applyTerrainMatrix: true,
          });
          if (projectionData.projectionTransition === 0) return;
        }

        gl.useProgram(program);

        // ── Compute globe position via inverse projection ─────────
        const globePosition = [0, 0, 0];

        const circumference = transform.worldSize;
        const globeRadius =
          (circumference / (2 * Math.PI)) *
          Math.cos((transform.center.lat * Math.PI) / 180);

        const globeCenter = [
          (transform.center.lng * Math.PI) / 180.0,
          (transform.center.lat * Math.PI) / 180.0,
        ];

        const cameraAngles = [
          transform.pitchInRadians != null
            ? transform.pitchInRadians
            : (transform.pitch * Math.PI) / 180,
          -(transform.bearingInRadians != null
            ? transform.bearingInRadians
            : (transform.bearing * Math.PI) / 180),
          -(transform.rollInRadians || 0),
        ];

        // ── Set uniforms ──────────────────────────────────────────
        gl.uniformMatrix4fv(
          gl.getUniformLocation(program, 'u_inv_proj_matrix'),
          false,
          transform.inverseProjectionMatrix
        );
        gl.uniform3fv(
          gl.getUniformLocation(program, 'u_globe_position'),
          globePosition
        );
        gl.uniform1f(
          gl.getUniformLocation(program, 'u_globe_radius'),
          globeRadius
        );
        gl.uniform1f(
          gl.getUniformLocation(program, 'u_stars_intensity'),
          intensity
        );
        gl.uniform2fv(
          gl.getUniformLocation(program, 'u_globe_center'),
          globeCenter
        );
        gl.uniform3fv(
          gl.getUniformLocation(program, 'u_camera_angles'),
          cameraAngles
        );

        // ── Draw ──────────────────────────────────────────────────
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.disable(gl.DEPTH_TEST);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.DEPTH_TEST);
      } catch (e) {
        // Silently ignore – stars are cosmetic, don't break the map
      }
    },
  };
}
