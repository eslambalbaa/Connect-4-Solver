CXX      := g++
CXXFLAGS := -std=c++20 -O3 -Wall -Wextra -Ibackend -include format

BACKEND_DIR := backend
SRCS        := $(wildcard $(BACKEND_DIR)/*.cpp)
HDRS        := $(wildcard $(BACKEND_DIR)/*.hpp)

ifeq ($(OS),Windows_NT)
    EXT        := .exe
    TARGET     := $(BACKEND_DIR)/solver$(EXT)
    WIN_TARGET := $(subst /,\,$(TARGET))
    RUN_CMD    := $(WIN_TARGET)
    CLEAN_CMD  := if exist "$(WIN_TARGET)" del /Q /F "$(WIN_TARGET)"
else
    EXT        :=
    TARGET     := $(BACKEND_DIR)/solver$(EXT)
    RUN_CMD    := ./$(TARGET)
    CLEAN_CMD  := rm -f $(TARGET)
endif

.PHONY: all run clean

all: $(TARGET)

$(TARGET): $(SRCS) $(HDRS)
	$(CXX) $(CXXFLAGS) $(SRCS) -o $(TARGET)

run: $(TARGET)
	$(RUN_CMD)

clean:
	$(CLEAN_CMD)
