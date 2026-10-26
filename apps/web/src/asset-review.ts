export function localAssetReviewEnabled():boolean {
  return import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('reviewAssets')==='1';
}
