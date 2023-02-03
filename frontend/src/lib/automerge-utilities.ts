export const uint8ToBase64 = (arr: Uint8Array) =>
    window.btoa(
        Array(arr.length)
            .fill('')
            .map((_, i) => String.fromCharCode(arr[i]))
            .join('')
    );

export const convertDataURIToBinary = (dataURI: string): Uint8Array => {
  const raw = window.atob(dataURI);
  const rawLength = raw.length;
  const array = new Uint8Array(new ArrayBuffer(rawLength));

  for(let i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}
