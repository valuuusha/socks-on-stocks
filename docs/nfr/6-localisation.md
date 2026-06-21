# Non-functional requirement 6 Localisation
### Definition: The application interface is in English. Support for other languages ​​is not provided within the MVP.
*Implementation*: We decided to implement this non-functional requirement by automated code check by Trivy instrument (it lies [here](https://github.com/valuuusha/socks-on-stocks/blob/main/.github/workflows/localization-check.yml)).
On each Pull Request into main branch it checks `frontend` and `backend` folders which include all source code that could pop up on users' screen.<br>
Failure looks like this
```
Run echo "Scanning frontend/ and backend/ for non-English characters..."
Scanning frontend/ and backend/ for non-English characters...
Non-English characters found:
frontend/src/components/TagsInput.tsx:14:  // Зберігаємо посилання на всі інпути, щоб фокусувати їх
frontend/src/components/TagsInput.tsx:39:        setCursorIndex(index - 1); // Курсор стає на місце видаленого тегу
frontend/src/components/TagsInput.tsx:56:  // Ця функція рендерить або активне поле (де ми пишемо), або невидиму "щілину"
frontend/src/components/TagsInput.tsx:78:            : "8px", // 8px - це ширина нашої невидимої щілини між тегами
frontend/src/components/TagsInput.tsx:89:        // Якщо клікнули кудись поза контейнером тегів
frontend/src/components/TagsInput.tsx:95:        // Якщо клікнули в пусте місце в кінці контейнера
Error: Process completed with exit code 1.
```
It stops Pull Request from Merge into main.
