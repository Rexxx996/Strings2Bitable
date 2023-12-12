import $ from 'jquery';
import { bitable, FieldType } from '@lark-base-open/js-sdk';
import './index.scss';
import './locales/i18n'; // 开启国际化，详情请看README.md

function showLoadingOverlay() {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function hideOverlay() {
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'none';
}

function updateReadingProgress(statusText, count) {
  const progressText = statusText + `${count}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function updateFinishProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadEndStatus').innerText = `${progressText}`;
}

function updateAnalyzeProgress(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadingStatus').innerText = `${progressText}`;
}

function showConfirmation(statusText, current, total) {
  const progressText = statusText + `${current}/${total}`;
  document.getElementById('loadEndStatus').innerText = `${progressText}`;
  document.getElementById('loadingOverlay').style.display = 'none';
  document.getElementById('loadEndOverlay').style.display = 'flex';

  // document.getElementById('btnConfirm').style.display = 'block';  // 显示确认按钮
}

$('#btnConfirm').on('click', async function() {
  hideOverlay();
});

$(async function() {

  const KEY_FIELD_NAME = "key";

  // console.log($.t('title')) // '这是中文标题'

  // 监听选择文件
  const inputFile = document.getElementById('inputFile');
  const inputLang = document.getElementById('inputLang');
  const btnAnalyzeFile = document.getElementById('btnAnalyzeFile');

  inputFile.addEventListener('change', updateButtonState);
  inputLang.addEventListener('input', updateButtonState);

  function updateButtonState() {
    if (inputFile.files.length > 0 && inputLang.value.trim() !== '') {
      btnAnalyzeFile.removeAttribute('disabled');
    } else {
      btnAnalyzeFile.setAttribute('disabled', true);
    }
  }

  // 解析文件
  $('#btnAnalyzeFile').on('click', async function() {
    // btnAnalyzeFile.addEventListener('click', async function() {

    // 显示加载图标
    showLoadingOverlay();

    const file = inputFile.files[0];
    if (file) {

      console.log('Input File:', file.name);
      console.log('Input Language:', inputLang.value)

      let fileTable = null;
      let fileTableIndex = null;
      let result = null;
      let langField = null;
      let keyField = null;
      let currProgress = 0;
      let totalProgress = 0;

      //创建数据表
      try {
        await bitable.base.addTable({
          name: file.name,
          fields: [
            {
              name: KEY_FIELD_NAME,
              type: FieldType.Text
            },
            {
              name: inputLang.value,
              type: FieldType.Text,
            }
          ]
        })

      } catch (error) {
        console.log('Table is exist.');
      }

      //获取数据表
      fileTable = await bitable.base.getTableByName(file.name);

      console.log('Get table:', fileTable);

      //获取/创建Key字段
      try {

        await fileTable.addField({ name: KEY_FIELD_NAME, type: FieldType.Text });

      } catch (error) {
        console.log('Key field is exist.', keyField);
      }

      keyField = await fileTable.getFieldByName<ITextFieldConfig>(KEY_FIELD_NAME);
      console.log('Get key field :', keyField);

      //获取/创建语言字段
      try {

        await fileTable.addField({ name: inputLang.value, type: FieldType.Text });

      } catch (error) {

        console.log('Language field is exist.', langField);
      }

      langField = await fileTable.getFieldByName<ITextFieldConfig>(inputLang.value);
      console.log('Get language field :', langField);

      currProgress = 0;
      updateReadingProgress('正在加载数据表：', currProgress);

      // 创建一个Map对象(key, value, record id)来存储Record
      const recordMap = new Map<string, string>();
      const recordList = await fileTable.getRecordList();

      console.log('Get record list:', recordList, recordList.length);

      for (const record of recordList) {
        const keyCell = await record.getCellByField(keyField);
        const keyVal = await keyCell.getValue();

        currProgress++;
        updateReadingProgress('正在加载数据表：', currProgress);

        // const langCell = await record.getCellByField(langField);
        // const langVal = await langCell.getValue();

        console.log("key Val:", keyVal);

        if (keyVal) {
          recordMap.set(keyVal[0].text, record.id);

          console.log('get record:', keyVal[0].text, ' ', record.id);
        }
        // else
        // {
        //   // 删除空行
        //   await fileTable.deleteRecord(record);
        // }
      }

      const reader = new FileReader();

      reader.onload = async function(event) {
        const fileContent = event.target.result;
        // 使用正则表达式提取"key"和"value"
        const keyValuePairs = fileContent.match(/"([^"]+)"\s*=\s*"([^"]+)"/g);

        console.log('keyValuePairs:', keyValuePairs.length);

        currProgress = 0;
        totalProgress = keyValuePairs.length;
        updateAnalyzeProgress('正在解析文件至数据表：', currProgress, totalProgress);

        if (keyValuePairs) {
          for (const pair of keyValuePairs) {
            const matches = pair.match(/"([^"]+)"\s*=\s*"([^"]+)"/);
            if (matches) {
              const key = matches[1];
              const value = matches[2];

              currProgress++;
              updateAnalyzeProgress('正在解析文件至数据表：', currProgress, totalProgress);

              if (recordMap.has(key)) {
                console.log('setCellValue:', langField.id, recordMap.get(key), value);

                const res = await fileTable.setCellValue(langField.id, recordMap.get(key), value)
                console.log('res:', res);
              }
              else {
                // const newKeyCell = await keyField.createCell(key);
                // const newLangCell = await langField.createCell(value);

                // const recordId = await fileTable.addRecord([[newKeyCell],[newLangCell]]);

                // recordMap.set(key, recordId);

                // console.log('New recordId:', recordId);

                const res = await fileTable.addRecord({
                  fields: {
                    [keyField.id]: key,
                    [langField.id]: value,
                  }
                });
                console.log('Add record:', res);
              }

              console.log('Key:', key);
              console.log('Value:', value);
            }
          }
        }

        // 加载完成
        showConfirmation('解析文件已完成：', currProgress, totalProgress);
      };

      reader.readAsText(file);

    }
  });


  const [tableList, selection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
  const optionsHtml = tableList.map(table => {
    return `<option value="${table.id}">${table.name}</option>`;
  }).join('');

  $('#tableSelect').append(optionsHtml).val(selection.tableId!);
  $('#addRecord').on('click', async function() {
    const tableId = $('#tableSelect').val();
    if (tableId) {
      const table = await bitable.base.getTableById(tableId as string);
      table.addRecord({
        fields: {},
      });
    }
  });
});


