#!/usr/bin/env python3
"""Probe and fully decode the reviewed item excerpts (requires FFmpeg)."""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,shutil,subprocess

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg',default=shutil.which('ffmpeg'))
    parser.add_argument('--ffprobe',default=shutil.which('ffprobe'))
    args=parser.parse_args()
    if not args.ffmpeg or not args.ffprobe:
        parser.error('Install FFmpeg in PATH or pass --ffmpeg and --ffprobe.')
    data=json.loads((ROOT/'data/tactical-items.json').read_text(encoding='utf-8'))
    def check(item):
        assert len(item['clips'])==1,item['id']
        clip=item['clips'][0];video=(ROOT/clip['path']).resolve()
        assert video.is_relative_to((ROOT/'assets/tactical-demos').resolve())
        assert hashlib.sha256(video.read_bytes()).hexdigest()==clip['sha256']
        result=subprocess.run([args.ffprobe,'-v','error','-show_format','-show_streams','-of','json',str(video)],capture_output=True,check=True,timeout=30)
        probe=json.loads(result.stdout);streams=probe['streams']
        assert len(streams)==1 and streams[0]['codec_type']=='video',item['id']+': silent video only'
        stream=streams[0]
        assert stream['codec_name']=='h264' and stream['pix_fmt']=='yuv420p',item['id']+': browser-compatible format'
        assert (stream['width'],stream['height'])==(clip['width'],clip['height'])
        assert abs(float(probe['format']['duration'])-clip['durationSeconds'])<.02,item['id']+': actual duration'
        num,den=map(int,stream['avg_frame_rate'].split('/'))
        assert num/den==clip['frameRate'],item['id']+': actual frame rate'
        assert int(probe['format']['size'])==clip['byteSize']
        # Decode the complete stream, including final frames; a valid header alone is insufficient.
        result=subprocess.run([args.ffmpeg,'-v','error','-xerror','-threads','1','-i',str(video),'-map','0:v:0','-f','null','-'],capture_output=True,timeout=60)
        assert result.returncode==0 and not result.stderr.strip(),item['id']+': decoding failed'
        poster=ROOT/clip['posterPath']
        result=subprocess.run([args.ffmpeg,'-v','error','-xerror','-i',str(poster),'-frames:v','1','-f','null','-'],capture_output=True,timeout=30)
        assert result.returncode==0 and not result.stderr.strip(),item['id']+': poster decoding failed'
        return clip['byteSize']
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        sizes=list(pool.map(check,data['items']))
    assert len(sizes)==136
    print(f'Passed: {len(sizes)} complete H.264 decodes and {len(sizes)} posters; metadata, duration, dimensions, frame rate, silent tracks and file integrity ({sum(sizes):,} video bytes).')

if __name__=='__main__':main()
