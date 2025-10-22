import { useMusicStore, useSettingStore } from "@/stores";
import { parsedLyricsData, parseTTMLToAMLL, parseTTMLToYrc, resetSongLyric } from "../lyric";
import { songLyric, songLyricTTML } from "@/api/song";
import { parseTTML } from "@applemusic-like-lyrics/lyric";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { LyricType } from "@/types/main";

/**
 * 获取歌词
 * @param id 歌曲id
 */
export const getLyricData = async (id: number) => {
  if (!id) {
    resetSongLyric();
    return;
  }

  try {
    const musicStore = useMusicStore();
    const settingStore = useSettingStore();
    // 检测本地歌词覆盖
    const getLyric = getLyricFun(settingStore.localLyricPath, id);
    const [lyricRes, ttmlContent] = await Promise.all([
      getLyric("lrc", songLyric),
      settingStore.enableTTMLLyric && getLyric("ttml", songLyricTTML),
    ]);
    parsedLyricsData(lyricRes);
    if (ttmlContent) {
      const parsedResult = parseTTML(ttmlContent);
      if (!parsedResult?.lines?.length) return;
      const ttmlLyric = parseTTMLToAMLL(parsedResult);
      const ttmlYrcLyric = parseTTMLToYrc(parsedResult);
      console.log("TTML lyrics:", ttmlLyric, ttmlYrcLyric);
      // 合并数据
      const updates: Partial<{ yrcAMData: LyricLine[]; yrcData: LyricType[] }> = {};
      if (ttmlLyric?.length) {
        updates.yrcAMData = ttmlLyric;
        console.log("✅ TTML AMLL lyrics success");
      }
      if (ttmlYrcLyric?.length) {
        updates.yrcData = ttmlYrcLyric;
        console.log("✅ TTML Yrc lyrics success");
      }
      if (Object.keys(updates).length) {
        musicStore.songLyric = {
          ...musicStore.songLyric,
          ...updates,
        };
      }
    }
  } catch (error) {
    console.error("❌ Error loading lyrics:", error);
    resetSongLyric();
  }
};

/**
 * 获取歌词函数生成器
 * @param paths 本地歌词路径数组
 * @param id 歌曲ID
 * @returns 返回一个函数，该函数接受扩展名和在线获取函数作为参数
 */
const getLyricFun =
  (paths: string[], id: number) =>
  async (
    ext: string,
    getOnline: (id: number) => Promise<string | null>,
  ): Promise<string | null> => {
    for (const path of paths) {
      const lyric = await window.electron.ipcRenderer.invoke("read-local-lyric", path, id, ext);
      if (lyric) return lyric;
    }
    return await getOnline(id);
  };
